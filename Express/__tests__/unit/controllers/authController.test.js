const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    regenerateApiKey
} = require('../../../auth/authController');
const User = require('../../../models/User');

// Mock dependencies
jest.mock('express-validator');
jest.mock('jsonwebtoken');
jest.mock('../../../models/User');

describe('Auth Controller', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            body: {},
            user: { userId: 1, email: 'test@example.com' }
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockNext = jest.fn();

        // Default mock for validation result
        validationResult.mockReturnValue({
            isEmpty: () => true,
            array: () => []
        });

        // Mock JWT with test environment expiration
        process.env.JWT_EXPIRES_IN = '1h';
    });

    describe('register', () => {
        it('should register user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                name: 'Test User',
                password: 'TestPass123'
            };

            mockReq.body = userData;

            const mockUser = {
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                toSafeObject: () => ({
                    id: 1,
                    email: 'test@example.com',
                    name: 'Test User',
                    api_key: 'mock-api-key'
                })
            };

            User.create.mockResolvedValue(mockUser);
            jwt.sign.mockReturnValue('mock-jwt-token');

            await register(mockReq, mockRes, mockNext);

            expect(User.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                name: 'Test User',
                password: 'TestPass123'
            });

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        user: expect.objectContaining({
                            id: 1,
                            email: 'test@example.com'
                        }),
                        token: 'mock-jwt-token',
                        auth: {
                            expiresIn: '1h',
                            tokenType: 'Bearer'
                        }
                    }),
                    message: 'User registered successfully',
                    meta: expect.objectContaining({
                        userId: 1,
                        action: 'register'
                    })
                })
            );
        });

        it('should handle validation errors', async () => {
            validationResult.mockReturnValue({
                isEmpty: () => false,
                array: () => [{ msg: 'Email is required' }]
            });

            await register(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                data: null,
                message: 'Validation failed',
                meta: expect.objectContaining({
                    errors: [{ msg: 'Email is required' }]
                })
            });
        });

        it('should handle duplicate email error', async () => {
            mockReq.body = {
                email: 'existing@example.com',
                name: 'Test User',
                password: 'TestPass123'
            };

            User.create.mockRejectedValue(new Error('User with this email already exists'));

            await register(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(409);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                data: null,
                message: 'A user with this email already exists. Please try logging in instead.',
                meta: expect.objectContaining({
                    action: 'register',
                    conflict: 'email'
                })
            });
        });
    });

    describe('login', () => {
        it('should login user successfully', async () => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'TestPass123'
            };

            const mockUser = {
                id: 1,
                email: 'test@example.com',
                verifyPassword: jest.fn().mockResolvedValue(true),
                updateLastLogin: jest.fn().mockResolvedValue(),
                toSafeObject: () => ({
                    id: 1,
                    email: 'test@example.com',
                    name: 'Test User'
                }),
                last_login: new Date()
            };

            User.findByEmail.mockResolvedValue(mockUser);
            jwt.sign.mockReturnValue('mock-jwt-token');

            await login(mockReq, mockRes, mockNext);

            expect(User.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(mockUser.verifyPassword).toHaveBeenCalledWith('TestPass123');
            expect(mockUser.updateLastLogin).toHaveBeenCalled();

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        user: expect.objectContaining({
                            email: 'test@example.com'
                        }),
                        token: 'mock-jwt-token'
                    }),
                    message: 'Login successful',
                    meta: expect.objectContaining({
                        action: 'login'
                    })
                })
            );
        });

        it('should reject non-existent user', async () => {
            mockReq.body = {
                email: 'nonexistent@example.com',
                password: 'TestPass123'
            };

            User.findByEmail.mockResolvedValue(null);

            await login(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                data: null,
                message: 'No account found with this email. Please register first.',
                meta: expect.objectContaining({
                    action: 'login',
                    suggestion: 'register'
                })
            });
        });

        it('should reject incorrect password', async () => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'WrongPassword'
            };

            const mockUser = {
                verifyPassword: jest.fn().mockResolvedValue(false)
            };

            User.findByEmail.mockResolvedValue(mockUser);

            await login(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                data: null,
                message: 'Incorrect password. Please try again.',
                meta: expect.objectContaining({
                    action: 'login'
                })
            });
        });
    });

    describe('getProfile', () => {
        it('should return user profile', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                toSafeObject: () => ({
                    id: 1,
                    email: 'test@example.com',
                    name: 'Test User'
                }),
                getClassificationCount: jest.fn().mockResolvedValue(5)
            };

            User.findById.mockResolvedValue(mockUser);

            await getProfile(mockReq, mockRes, mockNext);

            expect(User.findById).toHaveBeenCalledWith(1);
            expect(mockUser.getClassificationCount).toHaveBeenCalled();

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    user: expect.objectContaining({
                        id: 1,
                        email: 'test@example.com',
                        classification_count: 5
                    })
                },
                meta: expect.objectContaining({
                    userId: 1,
                    action: 'getProfile'
                })
            });
        });

        it('should handle user not found', async () => {
            User.findById.mockResolvedValue(null);

            await getProfile(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                data: null,
                message: 'User profile could not be found',
                meta: expect.objectContaining({
                    userId: 1
                })
            });
        });
    });

    describe('updateProfile', () => {
        it('should update user profile', async () => {
            mockReq.body = {
                name: 'Updated Name',
                email: 'updated@example.com'
            };

            const mockUser = {
                id: 1,
                update: jest.fn().mockResolvedValue(),
                toSafeObject: () => ({
                    id: 1,
                    email: 'updated@example.com',
                    name: 'Updated Name'
                })
            };

            User.findById.mockResolvedValue(mockUser);

            await updateProfile(mockReq, mockRes, mockNext);

            expect(mockUser.update).toHaveBeenCalledWith({
                name: 'Updated Name',
                email: 'updated@example.com'
            });

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    user: expect.objectContaining({
                        email: 'updated@example.com',
                        name: 'Updated Name'
                    })
                },
                message: 'Profile updated successfully',
                meta: expect.objectContaining({
                    action: 'updateProfile'
                })
            });
        });
    });

    describe('changePassword', () => {
        it('should change password successfully', async () => {
            mockReq.body = {
                currentPassword: 'OldPass123',
                newPassword: 'NewPass123'
            };

            const mockUser = {
                id: 1,
                verifyPassword: jest.fn().mockResolvedValue(true),
                changePassword: jest.fn().mockResolvedValue()
            };

            User.findById.mockResolvedValue(mockUser);

            await changePassword(mockReq, mockRes, mockNext);

            expect(mockUser.verifyPassword).toHaveBeenCalledWith('OldPass123');
            expect(mockUser.changePassword).toHaveBeenCalledWith('NewPass123');

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: null,
                message: 'Password changed successfully',
                meta: expect.objectContaining({
                    action: 'changePassword'
                })
            });
        });

        it('should reject incorrect current password', async () => {
            mockReq.body = {
                currentPassword: 'WrongPassword',
                newPassword: 'NewPass123'
            };

            const mockUser = {
                verifyPassword: jest.fn().mockResolvedValue(false)
            };

            User.findById.mockResolvedValue(mockUser);

            await changePassword(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                data: null,
                message: 'Current password is incorrect',
                meta: expect.objectContaining({
                    action: 'changePassword'
                })
            });
        });
    });

    describe('regenerateApiKey', () => {
        it('should regenerate API key', async () => {
            const mockUser = {
                id: 1,
                regenerateApiKey: jest.fn().mockResolvedValue('new-api-key')
            };

            User.findById.mockResolvedValue(mockUser);

            await regenerateApiKey(mockReq, mockRes, mockNext);

            expect(mockUser.regenerateApiKey).toHaveBeenCalled();

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    api_key: 'new-api-key'
                },
                message: 'API key regenerated successfully',
                meta: expect.objectContaining({
                    action: 'regenerateApiKey'
                })
            });
        });
    });
});