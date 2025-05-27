const jwt = require('jsonwebtoken');
const authMiddleware = require('../../../middleware/authMiddleware');

// Mock jwt
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            headers: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockNext = jest.fn();
    });

    describe('Valid Authentication', () => {
        it('should authenticate valid token', () => {
            mockReq.headers.authorization = 'Bearer valid-token';

            const decodedToken = {
                userId: 1,
                email: 'test@example.com'
            };

            jwt.verify.mockReturnValue(decodedToken);

            authMiddleware(mockReq, mockRes, mockNext);

            expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
            expect(mockReq.user).toEqual(decodedToken);
            expect(mockNext).toHaveBeenCalledWith();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });

    describe('Missing Authorization', () => {
        it('should reject request without authorization header', () => {
            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication required',
                message: 'Please provide a valid Bearer token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject empty authorization header', () => {
            mockReq.headers.authorization = '';

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication required',
                message: 'Please provide a valid Bearer token'
            });
        });
    });

    describe('Invalid Token Format', () => {
        it('should reject non-Bearer token format', () => {
            mockReq.headers.authorization = 'Basic some-token';

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid token format',
                message: 'Token must be provided as "Bearer <token>"'
            });
        });

        it('should reject Bearer without token', () => {
            mockReq.headers.authorization = 'Bearer ';

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token not provided',
                message: 'Please provide a valid Bearer token'
            });
        });

        it('should reject Bearer with only spaces', () => {
            mockReq.headers.authorization = 'Bearer    ';

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token not provided',
                message: 'Please provide a valid Bearer token'
            });
        });
    });

    describe('JWT Verification Errors', () => {
        beforeEach(() => {
            mockReq.headers.authorization = 'Bearer some-token';
        });

        it('should handle expired token', () => {
            const expiredError = new Error('Token expired');
            expiredError.name = 'TokenExpiredError';

            jwt.verify.mockImplementation(() => {
                throw expiredError;
            });

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Token expired',
                message: 'Please login again to get a new token'
            });
        });

        it('should handle invalid token signature', () => {
            const invalidError = new Error('Invalid signature');
            invalidError.name = 'JsonWebTokenError';

            jwt.verify.mockImplementation(() => {
                throw invalidError;
            });

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid token',
                message: 'Please provide a valid token'
            });
        });

        it('should handle malformed token', () => {
            const malformedError = new Error('Malformed token');
            malformedError.name = 'JsonWebTokenError';

            jwt.verify.mockImplementation(() => {
                throw malformedError;
            });

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid token',
                message: 'Please provide a valid token'
            });
        });

        it('should handle generic authentication error', () => {
            const genericError = new Error('Some other error');

            jwt.verify.mockImplementation(() => {
                throw genericError;
            });

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication error',
                message: 'An error occurred during authentication'
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle authorization header with different casing', () => {
            mockReq.headers.Authorization = 'Bearer valid-token'; // Capital A

            const decodedToken = {
                userId: 1,
                email: 'test@example.com'
            };

            jwt.verify.mockReturnValue(decodedToken);

            authMiddleware(mockReq, mockRes, mockNext);

            // Should not work as Express headers are lowercase
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should handle extra whitespace in Bearer token', () => {
            mockReq.headers.authorization = '  Bearer   valid-token  ';

            const decodedToken = {
                userId: 1,
                email: 'test@example.com'
            };

            jwt.verify.mockReturnValue(decodedToken);

            authMiddleware(mockReq, mockRes, mockNext);

            // Current implementation doesn't trim, so this should fail
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should handle very long token', () => {
            const longToken = 'a'.repeat(2000);
            mockReq.headers.authorization = `Bearer ${longToken}`;

            const decodedToken = {
                userId: 1,
                email: 'test@example.com'
            };

            jwt.verify.mockReturnValue(decodedToken);

            authMiddleware(mockReq, mockRes, mockNext);

            expect(jwt.verify).toHaveBeenCalledWith(longToken, process.env.JWT_SECRET);
            expect(mockReq.user).toEqual(decodedToken);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Security Considerations', () => {
        it('should not leak token in error messages', () => {
            mockReq.headers.authorization = 'Bearer secret-token-123';

            const invalidError = new Error('Invalid signature');
            invalidError.name = 'JsonWebTokenError';

            jwt.verify.mockImplementation(() => {
                throw invalidError;
            });

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    token: expect.anything()
                })
            );
        });

        it('should not expose internal error details', () => {
            mockReq.headers.authorization = 'Bearer some-token';

            const internalError = new Error('Database connection failed');

            jwt.verify.mockImplementation(() => {
                throw internalError;
            });

            authMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication error',
                message: 'An error occurred during authentication'
            });
        });
    });
});