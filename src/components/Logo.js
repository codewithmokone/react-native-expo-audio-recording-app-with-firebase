import React from 'react'
import { StyleSheet, View } from 'react-native';


function Logo() {
  return (
    <View style={styles.logoContainer} >

    </View>
  )
}

const styles = StyleSheet.create({
    logoContainer: {
      flex: 1,
      width: 390,
      height: 100,
      backgroundColor: 'black',
      alignItems: 'center',
    },
});

export default Logo