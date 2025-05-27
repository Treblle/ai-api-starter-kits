const User = require('../../../models/User');
const bcrypt = require('bcryptjs');
const database = require('../../../config/database');

// Mock database
jest.mock('../../../config/database', () => ({
    query: jest.fn(),
    transaction: jest.fn()
}));

describe('User Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new user with hashed password', async () => {
            const userData = {
                email: 'test@example.com',
                name: 'Test User',
                password: 'TestPass123'
            };

            const mockResult = {
                rows: [{
                    id: 1,
                    email: 'test@example.com',
                    name: 'Test User',
                    created_at: new Date(),
                    is_active: true,
                    api_key: 'mock-api-key'
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const user = await User.create(userData);

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO users'),
                expect.arrayContaining([
                    userData.email,
                    userData.name,
                    expect.any(String), // hashed password
                    expect.any(String)  // api key
                ])
            );

            expect(user).toBeInstanceOf(User);
            expect(user.id).toBe(1);
            expect(user.email).toBe('test@example.com');
        });

        it('should throw error for duplicate email', async () => {
            const userData = {
                email: 'existing@example.com',
                name: 'Test User',
                password: 'TestPass123'
            };

            database.query.mockRejectedValueOnce({
                code: '23505',
                constraint: 'users_email_key'
            });

            await expect(User.create(userData)).rejects.toThrow('User with this email already exists');
        });
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
            const mockResult = {
                rows: [{
                    id: 1,
                    email: 'test@example.com',
                    name: 'Test User',
                    password: 'hashed-password',
                    is_active: true,
                    api_key: 'mock-api-key'
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const user = await User.findByEmail('test@example.com');

            expect(database.query).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE email = $1 AND is_active = true',
                ['test@example.com']
            );

            expect(user).toBeInstanceOf(User);
            expect(user.email).toBe('test@example.com');
        });

        it('should return null if user not found', async () => {
            database.query.mockResolvedValueOnce({ rows: [] });

            const user = await User.findByEmail('nonexistent@example.com');

            expect(user).toBeNull();
        });
    });

    describe('verifyPassword', () => {
        it('should verify correct password', async () => {
            const user = new User({
                id: 1,
                password: await bcrypt.hash('TestPass123', 12)
            });

            const isValid = await user.verifyPassword('TestPass123');

            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const user = new User({
                id: 1,
                password: await bcrypt.hash('TestPass123', 12)
            });

            const isValid = await user.verifyPassword('WrongPassword');

            expect(isValid).toBe(false);
        });
    });

    describe('update', () => {
        it('should update user profile', async () => {
            const user = new User({ id: 1, name: 'Old Name', email: 'old@example.com' });

            const mockResult = {
                rows: [{
                    id: 1,
                    name: 'New Name',
                    email: 'new@example.com',
                    updated_at: new Date()
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            await user.update({ name: 'New Name', email: 'new@example.com' });

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users'),
                ['New Name', 'new@example.com', 1]
            );

            expect(user.name).toBe('New Name');
            expect(user.email).toBe('new@example.com');
        });

        it('should throw error for duplicate email', async () => {
            const user = new User({ id: 1 });

            database.query.mockRejectedValueOnce({
                code: '23505',
                constraint: 'users_email_key'
            });

            await expect(user.update({ email: 'existing@example.com' }))
                .rejects.toThrow('Email already in use');
        });
    });

    describe('regenerateApiKey', () => {
        it('should generate new API key', async () => {
            const user = new User({ id: 1 });

            const mockResult = {
                rows: [{ api_key: 'new-api-key' }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const newApiKey = await user.regenerateApiKey();

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users'),
                [expect.any(String), 1]
            );

            expect(newApiKey).toBe('new-api-key');
            expect(user.api_key).toBe('new-api-key');
        });
    });

    describe('toSafeObject', () => {
        it('should return safe user object without password', () => {
            const user = new User({
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                password: 'secret-password',
                api_key: 'api-key',
                created_at: new Date(),
                is_active: true
            });

            const safeObject = user.toSafeObject();

            expect(safeObject).not.toHaveProperty('password');
            expect(safeObject.id).toBe(1);
            expect(safeObject.email).toBe('test@example.com');
            expect(safeObject.name).toBe('Test User');
            expect(safeObject.api_key).toBe('api-key');
        });
    });

    describe('getStats', () => {
        it('should return user statistics', async () => {
            const mockResult = {
                rows: [{
                    total_users: '10',
                    active_users: '8',
                    active_last_30_days: '5',
                    new_last_7_days: '2'
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const stats = await User.getStats();

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT')
            );

            expect(stats.total_users).toBe('10');
            expect(stats.active_users).toBe('8');
        });
    });
});