import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Animated, Image } from 'react-native';
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
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [verifyingEmail, setVerifyingEmail] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [isForgotMode, setIsForgotMode] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const [alertConfig, setAlertConfig] = useState<{ msg: string; type: 'error' | 'warning' | 'success' | null }>({ msg: '', type: null });
    const slideAnim = useRef(new Animated.Value(-150)).current; // Start off-screen

    const triggerAlert = (msg: string, type: 'error' | 'warning' | 'success') => {
        setAlertConfig({ msg, type });

        Animated.spring(slideAnim, {
            toValue: Platform.OS === 'ios' ? 110 : 90,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();

        setTimeout(() => {
            Animated.timing(slideAnim, {
                toValue: -150,
                duration: 500,
                useNativeDriver: true,
            }).start(() => setAlertConfig({ msg: '', type: null }));
        }, 6000);
    };

    useEffect(() => {
        const checkDeletedBanner = async () => {
            try {
                const isDeleted = await SecureStore.getItemAsync('account_deleted_banner');
                if (isDeleted === 'true') {
                    await SecureStore.deleteItemAsync('account_deleted_banner');
                    triggerAlert("Your account has been successfully deleted. We're sorry to see you go and welcome you back anytime!", 'success');
                }
            } catch (error) {
                console.error('Error checking deleted banner:', error);
            }
        };
        checkDeletedBanner();
    }, []);

    const validateForm = () => {
        setErrorMsg('');

        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        if (isSignUp) {
            if (!name.trim()) {
                setErrorMsg('Name is required.');
                return false;
            }
        }

        if (!trimmedEmail) {
            setErrorMsg('Email Address is required.');
            return false;
        }

        if (!trimmedPassword) {
            setErrorMsg('Password is required.');
            return false;
        }

        // 2. Name length constraint (Sign Up Only)
        if (isSignUp && name.trim().length < 3) {
            setErrorMsg('Your name should be at least 3 characters long.');
            return false;
        }

        // 3. Structural Email Validation Regex
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(trimmedEmail)) {
            setErrorMsg('Please enter a valid email address.');
            return false;
        }

        // 4. Complexity Constraints (Sign Up Only — Protects Login Lane!)
        if (isSignUp) {
            const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
            const uppercaseRegex = /[A-Z]/;

            if (trimmedPassword.length < 8) {
                setErrorMsg('Password must be at least 8 characters long.');
                return false;
            }
            if (!uppercaseRegex.test(trimmedPassword)) {
                setErrorMsg('Password must include at least one uppercase letter.');
                return false;
            }
            if (!specialCharRegex.test(trimmedPassword)) {
                setErrorMsg('Password must include at least one special character (such as !@#$%^&*).');
                return false;
            }
        }

        return true;
    };

    const handleAuthAction = async () => {
        if (!validateForm()) return;

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPassword = password.trim();
        const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';

        let referrerId: number | null = null;
        if (isSignUp) {
            try {
                const storedReferrerId = await SecureStore.getItemAsync('invite_referrer_id');
                if (storedReferrerId) {
                    const parsedRef = parseInt(storedReferrerId, 10);
                    if (!isNaN(parsedRef)) {
                        referrerId = parsedRef;
                    }
                }
            } catch (err) {
                console.error('Failed to retrieve invite_referrer_id:', err);
            }
        }

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
                    password: normalizedPassword,
                    phoneNumber: (isSignUp && phoneNumber.trim()) ? phoneNumber.trim() : undefined,
                    referrerId: isSignUp ? referrerId : undefined,
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

            // If backend returned a non-verified response, transition to verification UI
            if (data.verified === false) {
                setVerifyingEmail(data.email || normalizedEmail);
                setIsVerifying(true);
                setErrorMsg('');
                setSuccessMsg(data.message || 'Verification code sent.');
                return;
            }

            if (data.token) {
                await SecureStore.setItemAsync('user_token', data.token);
            }
            if (data.id) {
                await SecureStore.setItemAsync('userId', String(data.id));
            }
            if (data.notifVibePeak !== undefined) {
                await SecureStore.setItemAsync('notif_vibe_peak', String(data.notifVibePeak));
            }
            if (data.notifProximity !== undefined) {
                await SecureStore.setItemAsync('notif_proximity', String(data.notifProximity));
            }
            if (data.notifSocial !== undefined) {
                await SecureStore.setItemAsync('notif_social', String(data.notifSocial));
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

    const handleVerifyCode = async () => {
        setErrorMsg('');
        setSuccessMsg('');

        if (!verificationCode.trim()) {
            setErrorMsg('Please enter the verification code.');
            return;
        }

        const BASE_URL = 'https://revynd-api-939729691035.us-east1.run.app';

        try {
            const response = await fetch(`${BASE_URL}/api/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: verifyingEmail,
                    code: verificationCode.trim(),
                }),
            });

            const rawText = await response.text();
            let data: any = {};
            if (rawText) {
                try {
                    data = JSON.parse(rawText);
                } catch {
                    data = { message: rawText.trim() };
                }
            }

            if (!response.ok) {
                setErrorMsg(data.message || 'Verification failed. Please check the code and try again.');
                return;
            }

            if (data.token) {
                await SecureStore.setItemAsync('user_token', data.token);
            }
            if (data.id) {
                await SecureStore.setItemAsync('userId', String(data.id));
            }
            if (data.notifVibePeak !== undefined) {
                await SecureStore.setItemAsync('notif_vibe_peak', String(data.notifVibePeak));
            }
            if (data.notifProximity !== undefined) {
                await SecureStore.setItemAsync('notif_proximity', String(data.notifProximity));
            }
            if (data.notifSocial !== undefined) {
                await SecureStore.setItemAsync('notif_social', String(data.notifSocial));
            }
            await SecureStore.deleteItemAsync('invite_referrer_id').catch(() => { });

            signIn({
                name: data.name || 'Rider',
                email: data.email,
                profilePicture: data.profilePicture || undefined,
            });

        } catch (error) {
            setErrorMsg('Unable to connect to REVYND core systems. Please try again later.');
            console.error('Verification Error Details:', error);
        }
    };

    const handleResendCode = async () => {
        setErrorMsg('');
        setSuccessMsg('');

        const BASE_URL = 'https://revynd-api-939729691035.us-east1.run.app';

        try {
            const response = await fetch(`${BASE_URL}/api/auth/resend-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: verifyingEmail,
                }),
            });

            const rawText = await response.text();
            let data: any = {};
            if (rawText) {
                try {
                    data = JSON.parse(rawText);
                } catch {
                    data = { message: rawText.trim() };
                }
            }

            if (!response.ok) {
                setErrorMsg(data.message || 'Failed to resend verification code.');
                return;
            }

            setSuccessMsg(data.message || 'Verification code resent successfully!');
        } catch (error) {
            setErrorMsg('Unable to connect to REVYND core systems. Please try again later.');
            console.error('Resend Error Details:', error);
        }
    };

    const handleSendResetCode = async () => {
        setErrorMsg('');
        setSuccessMsg('');

        if (!email.trim()) {
            setErrorMsg('Please enter your email address.');
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email.trim())) {
            setErrorMsg('Please enter a valid email address.');
            return;
        }

        const BASE_URL = 'https://revynd-api-939729691035.us-east1.run.app';

        try {
            const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                }),
            });

            const rawText = await response.text();
            let data: any = {};
            if (rawText) {
                try {
                    data = JSON.parse(rawText);
                } catch {
                    data = { message: rawText.trim() };
                }
            }

            if (!response.ok) {
                setErrorMsg(data.message || 'Failed to send reset code. Please try again.');
                return;
            }

            setVerifyingEmail(email.trim().toLowerCase());
            setIsResetting(true);
            setSuccessMsg(data.message || 'Verification code sent to your email.');

        } catch (error) {
            setErrorMsg('Unable to connect to REVYND core systems. Please try again later.');
            console.error('Forgot Password Error Details:', error);
        }
    };

    const handleResetPassword = async () => {
        setErrorMsg('');
        setSuccessMsg('');

        if (!resetCode.trim()) {
            setErrorMsg('Please enter the reset code.');
            return;
        }

        const trimmedNewPassword = newPassword.trim();
        if (!trimmedNewPassword) {
            setErrorMsg('Please enter a new password.');
            return;
        }

        // Password complexity validation (matches client-side constraints on register)
        const specialCharRegex = /[!@#$%^&*(),.?\":{}|<>]/;
        const uppercaseRegex = /[A-Z]/;

        if (trimmedNewPassword.length < 8) {
            setErrorMsg('Password must be at least 8 characters long.');
            return;
        }
        if (!uppercaseRegex.test(trimmedNewPassword)) {
            setErrorMsg('Password must include at least one uppercase letter.');
            return;
        }
        if (!specialCharRegex.test(trimmedNewPassword)) {
            setErrorMsg('Password must include at least one special character (such as !@#$%^&*).');
            return;
        }

        const BASE_URL = 'https://revynd-api-939729691035.us-east1.run.app';

        try {
            const response = await fetch(`${BASE_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: verifyingEmail,
                    code: resetCode.trim(),
                    password: trimmedNewPassword,
                }),
            });

            const rawText = await response.text();
            let data: any = {};
            if (rawText) {
                try {
                    data = JSON.parse(rawText);
                } catch {
                    data = { message: rawText.trim() };
                }
            }

            if (!response.ok) {
                setErrorMsg(data.message || 'Reset failed. Please check the code and try again.');
                return;
            }

            // Success: Reset UI states, redirect to Login
            setIsForgotMode(false);
            setIsResetting(false);
            setResetCode('');
            setNewPassword('');
            setIsSignUp(false); // Switch to Log In tab
            triggerAlert(data.message || 'Password reset successfully! Please log in.', 'success');

        } catch (error) {
            setErrorMsg('Unable to connect to REVYND core systems. Please try again later.');
            console.error('Reset Password Error Details:', error);
        }
    };

    if (isForgotMode && !isResetting) {
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.innerContainer}>
                    <Image source={require('../../assets/icon.png')} style={styles.appLogo} />
                    <Text style={styles.logo}>REVYND</Text>
                    <Text style={styles.subtitle}>
                        Reset your password
                    </Text>

                    <Text style={styles.instructions}>
                        Enter your email address and we'll send you a 6-digit code to reset your password.
                    </Text>

                    {/* Error Warning Banner Layout */}
                    {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                    {/* Success Banner Layout */}
                    {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

                    <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        placeholderTextColor={theme.subtext}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <TouchableOpacity style={styles.mainButton} onPress={handleSendResetCode}>
                        <Text style={styles.mainButtonText}>
                            Send Code
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toggleFooter}
                        onPress={() => {
                            setIsForgotMode(false);
                            setErrorMsg('');
                            setSuccessMsg('');
                        }}
                    >
                        <Text style={styles.toggleText}>
                            Back to{" "}
                            <Text style={styles.blueHighlight}>
                                Login
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
                <Animated.View style={[
                    styles.customAlert,
                    {
                        transform: [{ translateY: slideAnim }],
                        backgroundColor:
                            alertConfig.type === 'success' ? '#10B981' :
                                alertConfig.type === 'error' ? '#EF4444' :
                                    '#F59E0B'
                    }
                ]}>
                    <MaterialIcons
                        name={alertConfig.type === 'success' ? "check-circle" :
                            alertConfig.type === 'error' ? "block" :
                                "warning"}
                        size={20}
                        color="white"
                    />
                    <Text style={styles.alertText}>{alertConfig.msg}</Text>
                </Animated.View>
            </KeyboardAvoidingView>
        );
    }

    if (isForgotMode && isResetting) {
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.innerContainer}>
                    <Image source={require('../../assets/icon.png')} style={styles.appLogo} />
                    <Text style={styles.logo}>REVYND</Text>
                    <Text style={styles.subtitle}>
                        Choose a new password
                    </Text>

                    <Text style={styles.instructions}>
                        We sent a 6-digit reset code to{"\n"}
                        <Text style={styles.emailHighlight}>{verifyingEmail}</Text>
                    </Text>

                    {/* Error Warning Banner Layout */}
                    {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                    {/* Success Banner Layout */}
                    {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

                    <TextInput
                        style={styles.input}
                        placeholder="6-Digit Reset Code"
                        placeholderTextColor={theme.subtext}
                        value={resetCode}
                        onChangeText={setResetCode}
                        autoCapitalize="none"
                        keyboardType="number-pad"
                        maxLength={6}
                    />

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="New Password"
                            placeholderTextColor={theme.subtext}
                            secureTextEntry={!isPasswordVisible}
                            value={newPassword}
                            onChangeText={setNewPassword}
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

                    <TouchableOpacity style={styles.mainButton} onPress={handleResetPassword}>
                        <Text style={styles.mainButtonText}>
                            Reset Password
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toggleFooter}
                        onPress={handleSendResetCode}
                    >
                        <Text style={styles.toggleText}>
                            Didn't receive the code?{" "}
                            <Text style={styles.blueHighlight}>
                                Resend Code
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toggleFooter}
                        onPress={() => {
                            setIsResetting(false);
                            setIsForgotMode(false);
                            setErrorMsg('');
                            setSuccessMsg('');
                            setResetCode('');
                            setNewPassword('');
                        }}
                    >
                        <Text style={styles.toggleText}>
                            Back to{" "}
                            <Text style={styles.blueHighlight}>
                                Login
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
                <Animated.View style={[
                    styles.customAlert,
                    {
                        transform: [{ translateY: slideAnim }],
                        backgroundColor:
                            alertConfig.type === 'success' ? '#10B981' :
                                alertConfig.type === 'error' ? '#EF4444' :
                                    '#F59E0B'
                    }
                ]}>
                    <MaterialIcons
                        name={alertConfig.type === 'success' ? "check-circle" :
                            alertConfig.type === 'error' ? "block" :
                                "warning"}
                        size={20}
                        color="white"
                    />
                    <Text style={styles.alertText}>{alertConfig.msg}</Text>
                </Animated.View>
            </KeyboardAvoidingView>
        );
    }

    if (isVerifying) {
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.innerContainer}>
                    <Image source={require('../../assets/icon.png')} style={styles.appLogo} />
                    <Text style={styles.logo}>REVYND</Text>
                    <Text style={styles.subtitle}>
                        Verify your email address
                    </Text>

                    <Text style={styles.instructions}>
                        We sent a 6-digit code to{"\n"}
                        <Text style={styles.emailHighlight}>{verifyingEmail}</Text>
                    </Text>

                    {/* Error Warning Banner Layout */}
                    {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                    {/* Success Banner Layout */}
                    {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

                    <TextInput
                        style={styles.input}
                        placeholder="6-Digit Code"
                        placeholderTextColor={theme.subtext}
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        autoCapitalize="none"
                        keyboardType="number-pad"
                        maxLength={6}
                    />

                    <TouchableOpacity style={styles.mainButton} onPress={handleVerifyCode}>
                        <Text style={styles.mainButtonText}>
                            Verify Code
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toggleFooter}
                        onPress={handleResendCode}
                    >
                        <Text style={styles.toggleText}>
                            Didn't receive the code?{" "}
                            <Text style={styles.blueHighlight}>
                                Resend Code
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toggleFooter}
                        onPress={() => {
                            setIsVerifying(false);
                            setErrorMsg('');
                            setSuccessMsg('');
                            setVerificationCode('');
                        }}
                    >
                        <Text style={styles.toggleText}>
                            Go back to{" "}
                            <Text style={styles.blueHighlight}>
                                Login / Sign Up
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
                <Animated.View style={[
                    styles.customAlert,
                    {
                        transform: [{ translateY: slideAnim }],
                        backgroundColor:
                            alertConfig.type === 'success' ? '#10B981' :
                                alertConfig.type === 'error' ? '#EF4444' :
                                    '#F59E0B'
                    }
                ]}>
                    <MaterialIcons
                        name={alertConfig.type === 'success' ? "check-circle" :
                            alertConfig.type === 'error' ? "block" :
                                "warning"}
                        size={20}
                        color="white"
                    />
                    <Text style={styles.alertText}>{alertConfig.msg}</Text>
                </Animated.View>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.innerContainer}>
                <Image source={require('../../assets/icon.png')} style={styles.appLogo} />
                <Text style={styles.logo}>REVYND</Text>
                <Text style={styles.subtitle}>
                    {isSignUp ? "Create an account to track the vibe." : "Welcome back. Check the session."}
                </Text>

                {/* Error Warning Banner Layout */}
                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                {isSignUp && (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder="Preferred Name"
                            placeholderTextColor={theme.subtext}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Phone Number"
                            placeholderTextColor={theme.subtext}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            autoCapitalize="none"
                            keyboardType="phone-pad"
                        />
                    </>
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

                {!isSignUp && (
                    <TouchableOpacity
                        style={styles.forgotPasswordLink}
                        onPress={() => {
                            setIsForgotMode(true);
                            setErrorMsg('');
                            setSuccessMsg('');
                        }}
                    >
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>
                )}

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
            <Animated.View style={[
                styles.customAlert,
                {
                    transform: [{ translateY: slideAnim }],
                    backgroundColor:
                        alertConfig.type === 'success' ? '#10B981' :
                            alertConfig.type === 'error' ? '#EF4444' :
                                '#F59E0B'
                }
            ]}>
                <MaterialIcons
                    name={alertConfig.type === 'success' ? "check-circle" :
                        alertConfig.type === 'error' ? "block" :
                            "warning"}
                    size={20}
                    color="white"
                />
                <Text style={styles.alertText}>{alertConfig.msg}</Text>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const makeStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    innerContainer: { flex: 1, justifyContent: 'center', padding: 24 },
    appLogo: {
        width: 80,
        height: 80,
        alignSelf: 'center',
        marginBottom: 12,
        borderRadius: 20,
    },
    logo: { fontSize: 46, fontWeight: '900', color: theme.primary, textAlign: 'center', letterSpacing: 2 },
    subtitle: { textAlign: 'center', marginBottom: 20, fontSize: 15, fontWeight: '500', color: theme.subtext },
    errorText: { color: '#EF4444', backgroundColor: theme.card, padding: 12, borderRadius: 8, marginBottom: 20, textAlign: 'center', fontWeight: '600', fontSize: 14 },
    successText: { color: '#10B981', backgroundColor: theme.card, padding: 12, borderRadius: 8, marginBottom: 20, textAlign: 'center', fontWeight: '600', fontSize: 14 },
    input: { padding: 16, borderRadius: 12, marginBottom: 8, fontSize: 16, backgroundColor: theme.card, color: theme.text },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 10, marginBottom: 8 },
    passwordInput: { flex: 1, paddingVertical: 16, paddingRight: 8, color: theme.text, fontSize: 16 },
    eyeButton: { padding: 8 },
    mainButton: { backgroundColor: '#FB923C', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    toggleFooter: { marginTop: 24, alignItems: 'center' },
    toggleText: { fontSize: 14, fontWeight: '500', color: theme.subtext },
    blueHighlight: { color: theme.primary, fontWeight: '700' },
    instructions: { textAlign: 'center', marginBottom: 24, fontSize: 16, fontWeight: '500', color: theme.subtext, lineHeight: 22 },
    emailHighlight: { color: theme.text, fontWeight: '700' },
    forgotPasswordLink: { alignSelf: 'flex-end', marginTop: 4, marginBottom: 12, paddingVertical: 4 },
    forgotPasswordText: { fontSize: 13, fontWeight: '600', color: theme.primary },
    customAlert: {
        position: 'absolute',
        left: 20,
        right: 20,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 5,
        shadowColor: theme.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        zIndex: 1000,
    },
    alertText: {
        color: 'white',
        fontWeight: '600',
        marginLeft: 10,
        fontSize: 14,
        flex: 1,
    }
});