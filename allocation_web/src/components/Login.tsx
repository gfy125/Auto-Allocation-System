import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Lock, User, ArrowRight } from 'lucide-react';
import { loginUser, setCurrentUser, createUser, checkRegistration } from '../api';
import type { LoginRequest, CreateUserRequest } from '../api';
import { sanitizeLoginCredentials, validateUsername, validatePassword } from '../utils/inputSanitizer';

interface LoginProps {
  onLogin: (role: 'admin' | 'student', username?: string) => void;
  userRole: 'admin' | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, userRole }) => {
  const navigate = useNavigate();

  // if already logged in as admin, redirect to admin panel
  // student user does not redirect here to avoid covering /login access
  useEffect(() => {
    if (userRole === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [userRole, navigate]);
  
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const [createAccountData, setCreateAccountData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Real-time input validation
    if (name === 'username') {
      const validation = validateUsername(value);
      if (!validation.isValid && value.length > 0) {
        setError(validation.error || 'Invalid username');
      } else if (error) {
        setError('');
      }
    } else if (name === 'password') {
      const validation = validatePassword(value);
      if (!validation.isValid && value.length > 0) {
        setError(validation.error || 'Invalid password');
      } else if (error) {
        setError('');
      }
    }
    
    setCredentials(prev => ({...prev,[name]: value}));
    // clear success message
    if (success) setSuccess('');
  };

  const handleCreateAccountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Real-time input validation
    if (name === 'username') {
      const validation = validateUsername(value);
      if (!validation.isValid && value.length > 0) {
        setError(validation.error || 'Invalid username');
      } else if (error) {
        setError('');
      }
    } else if (name === 'password' || name === 'confirmPassword') {
      const validation = validatePassword(value);
      if (!validation.isValid && value.length > 0) {
        setError(validation.error || 'Invalid password');
      } else if (error) {
        setError('');
      }
    }
    
    setCreateAccountData(prev => ({...prev,[name]: value}));
    // clear success message
    if (success) setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Clean and validate input
      const { credentials: sanitizedCredentials, validation } = sanitizeLoginCredentials(credentials);
      
      if (!validation.isValid) {
        const errorMsg = validation.username.error || validation.password.error || 'Invalid input';
        setError(errorMsg);
        return;
      }
      
      // Call login API
      const loginData: LoginRequest = {
        username: sanitizedCredentials.username,
        password: sanitizedCredentials.password
      };
      
      const response = await loginUser(loginData);
      
      if (response.success && response.user) {
        // Save user information to local storage
        setCurrentUser(response.user);
        
        // Call parent component's login callback
        onLogin(response.user.role, response.user.displayName || response.user.username);
        
        // Navigate to admin panel after admin login
        navigate('/admin');
      } else {
        setError('Login failed: Invalid response from server.');
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle different types of errors
      if (error.message.includes('HTTP 401')) {
        setError('Invalid credentials! Please check your username and password.');
      } else if (error.message.includes('HTTP 404') && error.message.includes('NO_USERS_FOUND')) {
        setError('No users found in database. Please create an account first.');
        setShowCreateAccount(true);
      } else if (error.message.includes('HTTP 503')) {
        setError('Service Unavailable: Backend server is not running. Please ensure the backend server is started.');
      } else if (error.message.includes('HTTP 408')) {
        setError('Request Timeout: Please try again.');
      } else if (error.message.includes('HTTP 500')) {
        setError('Internal Server Error: Please contact support if this persists.');
      } else {
        setError(`Login failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAccount(true);
    setError('');
    setSuccess('');
    
    try {
      // Clean and validate input
      const usernameValidation = validateUsername(createAccountData.username);
      const passwordValidation = validatePassword(createAccountData.password);
      
      if (!usernameValidation.isValid) {
        setError(usernameValidation.error || 'Invalid username');
        return;
      }
      
      if (!passwordValidation.isValid) {
        setError(passwordValidation.error || 'Invalid password');
        return;
      }
      
      // Validate password match
      if (createAccountData.password !== createAccountData.confirmPassword) {
        setError('Passwords do not match!');
        return;
      }

      // Step 1: Check if registration is available
      const registrationCheck = await checkRegistration();
      
      if (!registrationCheck.canRegister) {
        setError('Registration is not allowed. Users already exist in the database.');
        return;
      }

      // Step 2: Create user
      const userData: CreateUserRequest = {
        username: createAccountData.username,
        password: createAccountData.password,
        confirmPassword: createAccountData.confirmPassword
      };
      
      const response = await createUser(userData);
      
      if (response.success) {
        setSuccess('Account created successfully! Please refresh the page and login.');
        setCreateAccountData({ username: '', password: '', confirmPassword: '' });
        setShowCreateAccount(false);
      } else {
        setError('Failed to create account: Invalid response from server.');
      }
      
    } catch (error: any) {
      console.error('Create account error:', error);
      
      // Handle different types of errors
      if (error.message.includes('HTTP 403') && error.message.includes('REGISTRATION_DISABLED')) {
        setError('Registration is not allowed. Users already exist in the database.');
      } else if (error.message.includes('HTTP 400')) {
        if (error.message.includes('PASSWORD_MISMATCH')) {
          setError('Passwords do not match!');
        } else if (error.message.includes('USERNAME_TOO_SHORT')) {
          setError('Username must be at least 3 characters long!');
        } else if (error.message.includes('PASSWORD_TOO_SHORT')) {
          setError('Password must be at least 6 characters long!');
        } else {
          setError('Invalid input: Please check your information.');
        }
      } else if (error.message.includes('HTTP 503')) {
        setError('Service Unavailable: Backend server is not running. Please ensure the backend server is started.');
      } else if (error.message.includes('HTTP 408')) {
        setError('Request Timeout: Please try again.');
      } else if (error.message.includes('HTTP 500')) {
        setError('Internal Server Error: Please contact support if this persists.');
      } else {
        setError(`Create account failed: ${error.message}`);
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4">
      {/* background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 dark:bg-blue-800 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 dark:bg-purple-800 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-200 dark:bg-pink-800 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo decoration */}
        <div className="text-center mb-8">
          <img 
            src="/logo_uni_tran.png" 
            alt="University Logo" 
            className="w-30 h-30 mx-auto mb-4 drop-shadow-lg"
          />

        </div>

        {/* login card */}
        <Card className="shadow-2xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">   
          <CardContent className="space-y-6">

            <Separator className="my-6" />

            {/* success message */}
            {success && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {/* login form */}
            {!showCreateAccount ? (
              <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 dark:text-slate-300">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={credentials.username}
                    onChange={handleInputChange}
                    placeholder="Enter username"
                    className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={credentials.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* error message for login */}
              {error && !showCreateAccount && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Logging in...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Lock className="w-4 h-4 mr-2" />
                    Login
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
                )}
              </Button>

              {/* Register Button */}
              <Button 
                type="button"
                onClick={() => setShowCreateAccount(true)}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Register
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Button>
            </form>
            ) : (
              /* Create Account Form */
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-username" className="text-slate-700 dark:text-slate-300">
                    Username
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="create-username"
                      name="username"
                      type="text"
                      value={createAccountData.username}
                      onChange={handleCreateAccountInputChange}
                      placeholder="Enter username (min 3 characters)"
                      className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="create-password" className="text-slate-700 dark:text-slate-300">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="create-password"
                      name="password"
                      type="password"
                      value={createAccountData.password}
                      onChange={handleCreateAccountInputChange}
                      placeholder="Enter password (min 6 characters)"
                      className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-700 dark:text-slate-300">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type="password"
                      value={createAccountData.confirmPassword}
                      onChange={handleCreateAccountInputChange}
                      placeholder="Confirm password"
                      className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* error message for create account */}
                {error && showCreateAccount && (
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={isCreatingAccount}
                >
                  {isCreatingAccount ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Account...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Create Account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </div>
                  )}
                </Button>

                <Button 
                  type="button"
                  onClick={() => setShowCreateAccount(false)}
                  className="w-full bg-slate-500 hover:bg-slate-600 text-white"
                >
                  Back to Login
                </Button>
              </form>
            )}

            

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
