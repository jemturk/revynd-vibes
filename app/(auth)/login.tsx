import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { useTheme } from '../../theme/ThemeContext';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
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

        // 1. Basic Presence Validation (with clean string trimming)
        if (!email.trim() || !password || (isSignUp && !name.trim())) {
            setErrorMsg('All fields are required.');
            return false;
        }

        // 2. Name length constraint (Sign Up Only)
        if (isSignUp && name.trim().length < 3) {
            setErrorMsg('Your name should be at least 3 characters long.');
            return false;
        }

        // 3. Structural Email Validation Regex
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email.trim())) {
            setErrorMsg('Please enter a valid email address.');
            return false;
        }

        // 4. Complexity Constraints (Sign Up Only — Protects Login Lane!)
        if (isSignUp) {
            const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
            const uppercaseRegex = /[A-Z]/;

            if (password.length < 8) {
                setErrorMsg('Password must be at least 8 characters long.');
                return false;
            }
            if (!uppercaseRegex.test(password)) {
                setErrorMsg('Password must include at least one uppercase letter.');
                return false;
            }
            if (!specialCharRegex.test(password)) {
                setErrorMsg('Password must include at least one special character (such as !@#$%^&*).');
                return false;
            }
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

            // 2. Safely parse JSON, but preserve plain string bodies too
            let data: any = {};
            if (rawText) {
                try {
                    data = JSON.parse(rawText);
                } catch {
                    data = { message: rawText.trim() };
                }
            }
            if (!response.ok) {
                const rawMsg = rawText?.trim() || '';
                let backendMessage = data?.message || data?.error || data?.detail;

                console.log(response);

                // 1. Direct deep scan across the raw incoming string for the duplicate email flag
                // This will catch it even if it's buried in an HTML page or stack trace
                if (/already exists/i.test(rawMsg) || /already exists/i.test(backendMessage || '')) {
                    setErrorMsg('An account with this email already exists. Please log in instead.');
                    return;
                }

                // 2. Process other general exceptions if it isn't a duplicate email error
                if (!backendMessage && rawMsg) {
                    if (rawMsg.includes('IllegalArgumentException:')) {
                        const match = rawMsg.match(/IllegalArgumentException:\s*([^\n\r<]+)/);
                        if (match && match[1]) {
                            backendMessage = match[1].trim();
                        }
                    } else if (rawMsg.includes('<html') || rawMsg.includes('<body')) {
                        backendMessage = isSignUp
                            ? 'Server validation failed during registration.'
                            : 'Server validation failed during login.';
                    } else {
                        backendMessage = rawMsg;
                    }
                }

                const normalizedMessage = typeof backendMessage === 'string'
                    ? backendMessage.replace(/^[^:]+:\s*/, '').trim()
                    : null;

                const finalMessage = normalizedMessage || (typeof backendMessage === 'string' ? backendMessage : rawMsg);

                // 3. Output evaluation for other errors
                if (finalMessage && finalMessage.length < 200) {
                    setErrorMsg(finalMessage);
                } else {
                    setErrorMsg(
                        isSignUp
                            ? 'Account creation failed. Please check your details and try again.'
                            : 'Sign In failed. Please check your credentials and try again.'
                    );
                }
                return;
            }

            if (data.token) {
                await SecureStore.setItemAsync('user_token', data.token);
            }

            signIn({
                name: data.name || 'Rider',
                email: data.email,
                profilePicture: data.profilePicture || undefined,
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