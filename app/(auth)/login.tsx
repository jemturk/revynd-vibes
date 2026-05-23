import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { useTheme } from '../../theme/ThemeContext';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen () {
    const { signIn } = useAuth();
    const { theme } = useTheme();
    const styles = makeStyles(theme);

    const [isSignUp, setIsSignUp] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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

    const handleAuthAction = async () => {
        if (!validateForm()) return;

        const normalizedEmail = email.trim().toLowerCase();
        const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';

        // Hardcoding the live Google Cloud Run Service URL directly
        const BASE_URL = 'https://revynd-api-939729691035.us-east1.run.app';

try {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json', // Signals to Spring Boot to deliver structured JSON
                },
                body: JSON.stringify({
                    name: isSignUp ? name.trim() : undefined,
                    email: normalizedEmail,
                    password: password,
                }),
            });

            // 1. Capture the raw payload as a text block first to protect the UI loop
            const rawText = await response.text();
            
            // 2. Safely check the syntax profile of the response string
            let data;
            try {
                data = rawText ? JSON.parse(rawText) : {};
            } catch (jsonParseError) {
                console.error('❌ JavaScript engine failed to parse raw server context:', jsonParseError);
                setErrorMsg('Server returned an invalid data payload layout.');
                return;
            }

            if (!response.ok) {
                setErrorMsg(data.message || 'Authentication failed.');
                return;
            }
            
            if (data.token) {
                await SecureStore.setItemAsync('user_token', data.token);
            }

            signIn({
                name: data.name || 'Rider',
                email: data.email,
            });

        } catch (error) {
            setErrorMsg('Unable to connect to REVYND core systems. Please try again later.');
            console.error('Network Error Details:', error);
        }
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
                        placeholderTextColor={theme.subtext}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                    />
                )}

                <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor={theme.subtext}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor={theme.subtext}
                        secureTextEntry={!isPasswordVisible}
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setIsPasswordVisible((prev) => !prev)} style={styles.eyeButton}>
                        <MaterialIcons
                            name={isPasswordVisible ? 'visibility' : 'visibility-off'}
                            size={24}
                            color={theme.subtext}
                        />
                    </TouchableOpacity>
                </View>

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

const makeStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    innerContainer: { flex: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 46, fontWeight: '900', color: theme.primary, textAlign: 'center', letterSpacing: 2 },
    subtitle: { textAlign: 'center', marginBottom: 20, fontSize: 15, fontWeight: '500', color: theme.subtext },
    errorText: { color: '#EF4444', backgroundColor: theme.card, padding: 12, borderRadius: 8, marginBottom: 20, textAlign: 'center', fontWeight: '600', fontSize: 14 },
    input: { padding: 16, borderRadius: 12, marginBottom: 8, fontSize: 16, backgroundColor: theme.card, color: theme.text },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 10, marginBottom: 8 },
    passwordInput: { flex: 1, paddingVertical: 16, paddingRight: 8, color: theme.text },
    eyeButton: { padding: 8 },
    mainButton: { backgroundColor: '#FB923C', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    toggleFooter: { marginTop: 24, alignItems: 'center' },
    toggleText: { fontSize: 14, fontWeight: '500', color: theme.subtext },
    blueHighlight: { color: theme.primary, fontWeight: '700' }
});