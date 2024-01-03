import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react'
import { Text, View, TextInput, StyleSheet, KeyboardAvoidingView, Pressable, Alert } from 'react-native'
import { auth } from '../../firebaseconfig';
import { useNavigation } from '@react-navigation/native';

function Login() {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const navigation = useNavigation()

  const handleLogin = () => {

    if(!email || !password){
      return setErrorMessage("Email and password required");
    }

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        navigation.navigate('Home');
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        // Handle sign-in errors here
        if (errorCode === 'auth/wrong-password') {
          setErrorMessage('Invalid email/password');
        } else {
          setErrorMessage(errorMessage)
        }
      });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const uid = user.uid;
        navigation.navigate('Home')
      } else {
        console.log('User is signed out')
      }
    })

    return unsubscribe
  }, [])

  const handleNavigate = () => {
    navigation.navigate('Register')
  }


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior='padding'
    >
      <View style={styles.inputContainer}>
        <View style={{alignItems:'center'}}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>
        <View>
          <Text>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            placeholder=" Enter your email"
            onChangeText={text => setEmail(text)}
          />
          <Text>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            placeholder=" Enter your password"
            onChangeText={text => setPassword(text)}
            secureTextEntry
          />
        </View>
        <View style={styles.btnSection}>
          <Pressable style={styles.button} onPress={() => handleLogin()}>
            <Text style={styles.btnText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.signupLink}>
        <Text>Don't have an account?</Text>
        <Pressable style={styles.linkButton} onPress={handleNavigate}>
          <Text style={styles.btnText}> Sign Up</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DDC3A5',
    alignItems: 'center',
    justifyContent: 'center'
  },

  heading: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 20
  },

  inputContainer: {
    width: '80%',
  },

  input: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 5,
    marginBottom: 15
  },

  buttonLogin: {
    marginTop: 20,
  },

  signupLink: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignContent: 'center'
  },

  btnSection: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  button: {
    width: 150,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
    elevation: 3,
    backgroundColor: 'black',
  },

  btnText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 'bold',
    letterSpacing: 0.25,
    color: '#E0A96D',
  },
  errorText: {
    color: 'red',
  }
});

export default Login