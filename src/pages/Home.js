import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react'
import { Button, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { auth, db, storage } from '../../firebaseconfig';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Audio } from 'expo-av';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Icon from 'react-native-vector-icons/FontAwesome';

function Home() {

    const [name, setName] = useState("");
    const [recording, setRecording] = useState('');
    const [recordings, setRecordings] = useState([]);
    // const [recordingFile, setRecordingFile] = useState()
    const [message, setMessage] = useState("");
    const [editingIndex, setEditingIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);

    const navigation = useNavigation();

    const recordingOptions = {
        isMeteringEnabled: true,
        android: {
            extension: '.m4a',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
        },
        ios: {
            extension: '.m4a',
            outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
        },
        web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
        },
    };

    const user = auth.currentUser;

    const handleSignOut = () => {
        signOut(auth)
            .then(() => {
                navigation.navigate('Login');
            })
    }

    // Handles the recording function
    async function startRecording() {
        try {

            const permission = await Audio.requestPermissionsAsync();

            if (permission.status === "granted") {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true
                });

                const { recording } = await Audio.Recording.createAsync(
                    recordingOptions
                );

                setRecording(recording);
            } else {
                setMessage("Please grant permission to app to access microphone");
            }
        } catch (err) {
            console.log("Failed to start recording", err)
        }
    }

    // Handles aving the recording to firebase
    async function stopRecording() {

        try {
            setRecording(undefined);
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const { sound, status } = await recording.createNewLoadedSoundAsync();

            const audioFile = await recording.getURI();
            const blob = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.onload = () => {
                    try {
                        resolve(xhr.response);
                    } catch (error) {
                        console.log("error:", error);
                    }
                };
                xhr.onerror = (e) => {
                    console.log(e);
                    reject(new TypeError("Network request failed"));
                };
                xhr.responseType = "blob";
                xhr.open("GET", audioFile, true);
                xhr.send(null);
            });

            if (blob != null) {
                const audioFileRef = ref(storage, `audio/${user.uid}/${name}`);
                const upload = uploadBytes(audioFileRef, blob).then(() => {
                    getDownloadURL(audioFileRef).then(async (url) => {
                        await addDoc(collection(db, 'recordings'), {
                            name: name,
                            duration: getDurationFormatted(status.durationMillis),
                            fileURL: url,
                            userId: user.uid,
                        })
                    })
                })

                let updatedRecordings = [
                    ...recordings,
                    {
                        sound: sound,
                        duration: getDurationFormatted(status.durationMillis),
                        file: audioFile,
                        name: name,
                    }
                ];

                setRecordings(updatedRecordings);
                setRecording(null)
                setName('')

            }
        } catch (err) {
            console.log(err)
        }
    }

    // Handles the recording duration
    function getDurationFormatted(millis) {
        const minutes = millis / 1000 / 60;
        const minutesDisplay = Math.round(minutes);
        const seconds = Math.round((minutes - minutesDisplay) * 60);
        const secondsDisplay = seconds < 10 ? `0${seconds}` : seconds;
        return `${minutesDisplay}:${secondsDisplay}`;
    }

    // Handles the stored recordings view
    function getRecordingLines() {
        return recordings.map((recordingLine, index) => {

            const sound = new Audio.Sound();

            // Handles the play function
            const handlePlay = async () => {
                if (!isPlaying) {
                    try {
                        setIsPlaying(true)
                        await sound.loadAsync({ uri: recordingLine.fileURL })
                        await sound.playAsync();
                        sound.setOnPlaybackStatusUpdate(status => {
                            if (status.didJustFinish) {
                                setIsPlaying(false);
                            }
                        });
                    } catch (err) {
                        console.log('Error playing audio', err);
                        setIsPlaying(false);
                    }
                }
            }

            return (
                <View key={index} style={styles.row}>
                    <Text style={styles.fill}>{recordingLine.name} - {recordingLine.duration}</Text>
                    <Pressable style={styles.btnEdit} onPress={handlePlay}>
                        <Icon name="play" size={20} color="#E0A96D" />
                    </Pressable>
                    <View style={styles.btnEdit}>
                        {
                            editingIndex === index ? (
                                <View>
                                    <Pressable onPress={() => updateRecording(index)}>
                                        <Icon name="save" size={20} color="#E0A96D" />
                                    </Pressable>
                                </View>
                            ) : (
                                <View>
                                    <Pressable onPress={() => editRecordingName(index)}>
                                        <Icon name="edit" size={20} color="#E0A96D" />
                                    </Pressable>
                                </View>
                            )
                        }
                    </View>

                    <Pressable style={styles.btnDelete} onPress={() => deleteRecording(index)}>
                        <Icon name="remove" size={20} color="#E0A96D" />
                    </Pressable>
                </View>
            );
        });
    }

    // Handles the edit functionality
    function editRecordingName(index) {
        setEditingIndex(index);
        setName(recordings[index].name);
    }

    // Handles the update functionality
    async function updateRecording(index) {

        const recording = recordings[index]

        try {
            // Update the name in Firestore
            const recordRef = doc(db, 'recordings', recording.firestoreDocId);
            await updateDoc(recordRef, { name: name });

            const updatedRecordings = recordings.map((recordingItem) => {
                if (recordingItem.id === recording.firestoreDocId) {
                    return { ...recordingItem, name: name };
                }
                return recordingItem;
            });

            setRecordings(updatedRecordings);
            console.log('Title updated')
        } catch (err) {
            console.log("Error renaming audio:", err)
        }

    }

    // Handles the delete recording function
    async function deleteRecording(index) {

        const recordingToDelete = recordings[index];

        console.log(recordingToDelete.firestoreDocId)

        try {

            // Delete from Firestore
            const recordingDocRef = doc(db, 'recordings', recordingToDelete.firestoreDocId);
            await deleteDoc(recordingDocRef);
            console.log('Recording details deleted from Firebase');

            //  Delete from Firebase Storage
            const audioFileRef = ref(storage, `audio/${user.uid}/${recordingToDelete.name}`);
            await deleteObject(audioFileRef);
            console.log('Recording deleted from storage');

        } catch (err) {
            console.log(err);
        }

        // Update the state after deleting
        const updatedRecordings = recordings.filter((_, i) => i !== index);
        setRecordings(updatedRecordings);
    }

    // Loading the recording from Firebase Firestore
    async function loadRecordings() {
        if (user) {
            try {
                const recordingsCollection = collection(db, 'recordings');
                const recordingSnapshot = await getDocs(
                    query(recordingsCollection, where('userId', '==', user.uid))
                );

                const loadedRecordings = [];
                recordingSnapshot.forEach((doc) => {
                    const recordingData = doc.data();
                    loadedRecordings.push({
                        firestoreDocId: doc.id,
                        ...recordingData,
                    });
                });

                setRecordings(loadedRecordings);
            } catch (err) {
                console.log(err)
            }
        }
    }

    useEffect(() => {
        if (user) {
            // Load saved recordings when the components mount
            loadRecordings();
        }
    }, [user])

    return (
        <View style={styles.container}>
            <View style={styles.userInfo} >
                <Text style={styles.userInfoText}><Icon name="user" size={20} color='#E0A96D' /> : {auth.currentUser?.email}</Text>
                <Text style={styles.userInfoButton} onPress={handleSignOut}>Log Out</Text>
            </View>
            <View style={styles.headingContainer}>
                <Text>Press start to record your message.</Text>

                <Text>{message}</Text>

                <Text style={styles.recordingTitle}>Recording title:</Text>
                <TextInput
                    style={styles.input}
                    placeholder=' Recording Name'
                    value={name}
                    onChangeText={setName}
                />
                <Button
                    title={recording ? 'Stop Recording' : 'Start Recording'}
                    onPress={recording ? stopRecording : startRecording}
                />
            </View>
            <View style={styles.inputSection}>

            </View>
            <View >
                {getRecordingLines()}
            </View>

        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#DDC3A5'
    },

    userInfo: {
        width: 390,
        height: 40,
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: 'black',
        alignItems: 'center',
        justifyContent: 'space-between'
    },

    userInfoText: {
        color: '#E0A96D',
        margin: 5,
    },

    userInfoButton: {
        color: '#E0A96D',
        marginRight: 10,
    },

    headingContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 30
    },

    recordingTitle: {
        margin: 10,
        fontWeight: 'bold'
    },

    input: {
        borderWidth: 1,
        borderRadius: 5,
        borderColor: 'ivory',
        width: 200,
        height: 30,
        marginBottom: 10
    },

    row: {
        backgroundColor: 'black',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: 350,
        margin: 5,
        borderRadius: 5,
    },

    fill: {
        flex: 1,
        margin: 16,
        color: '#E0A96D',
    },

    button: {
        width: 10,
        margin: 16,
    },

    inputSection: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 20,
    },

    signoutButton: {
        marginTop: 100,
    },

    btnEdit: {
        marginLeft: 20,
        marginRight: 20,
    },

    btnDelete: {
        marginRight: 20,
    }
})

export default Home