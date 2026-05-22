import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../_layout';

export default function AuthScreen() {
  const { signIn } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const validateForm = () => {
    setErrorMsg('');

    // 1. All fields required validation
    if (!email || !password || (isSignUp && !name)) {
      setErrorMsg('All fields are strictly required.');
      return false;
    }

    // 2. Name length validation (min 3 chars)
    if (isSignUp && name.trim().length < 3) {
      setErrorMsg('Name must be at least 3 characters long.');
      return false;
    }

    // 3. Email pattern validation (contains @ and .)
    if (!email.includes('@') || !email.includes('.')) {
      setErrorMsg('Please enter a valid email address containing "@" and "."');
      return false;
    }

    // 4. Password policy validation (min 8 chars, 1 uppercase, 1 special char)
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    const uppercaseRegex = /[A-Z]/;

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return false;
    }
    if (!uppercaseRegex.test(password)) {
      setErrorMsg('Password requires at least one uppercase letter.');
      return false;
    }
    if (!specialCharRegex.test(password)) {
      setErrorMsg('Password requires at least one special character (!@#$%^&*).');
      return false;
    }

    return true;
  };

  const handleAuthAction = () => {
    if (!validateForm()) return; // Stop execution if rules fail

    // Once validated, compile credentials into global state context
    const simulatedUser = {
      name: isSignUp ? name.trim() : "Welcome Back User", // Handled by API later
      email: email.trim().toLowerCase()
    };

    signIn(simulatedUser);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.logo}>REVYND</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Create an account to track the vibe." : "Welcome back. Check the session."}
        </Text>

        {/* Error Warning Banner Layout */}
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        {isSignUp && (
          <TextInput 
            style={styles.input} 
            placeholder="Full Name" 
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput 
          style={styles.input} 
          placeholder="Email Address" 
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          placeholderTextColor="#64748B"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.mainButton} onPress={handleAuthAction}>
          <Text style={styles.mainButtonText}>
            {isSignUp ? "Create Account" : "Sign In"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggleFooter} 
          onPress={() => {
            setIsSignUp(!isSignUp);
            setErrorMsg('');
          }}
        >
          <Text style={styles.toggleText}>
            {isSignUp ? "Already have an account? " : "First time here? "}
            <Text style={styles.blueHighlight}>
              {isSignUp ? "Log In" : "Sign Up"}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  innerContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 46, fontWeight: '900', color: '#639cec', textAlign: 'center', letterSpacing: 2 },
  subtitle: { textAlign: 'center', marginBottom: 20, fontSize: 15, fontWeight: '500', color: '#94A3B8' },
  errorText: { color: '#EF4444', backgroundColor: '#451A03', padding: 12, borderRadius: 8, marginBottom: 20, textAlign: 'center', fontWeight: '600', fontSize: 14 },
  input: { padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16, backgroundColor: '#1E293B', color: '#FFFFFF' },
  mainButton: { backgroundColor: '#FB923C', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toggleFooter: { marginTop: 24, alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
  blueHighlight: { color: '#639cec', fontWeight: '700' }
});