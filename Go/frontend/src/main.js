import './style.css';
import { isAuthenticated, getToken, removeToken } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }
    
    // Setup logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            removeToken();
            window.location.href = '/login.html';
        });
    }
    const inputText = document.getElementById('input-text');
    const translateBtn = document.getElementById('translate-btn');
    const outputText = document.getElementById('output-text');

    // Function to create and animate floating hearts
    function createFloatingHeart(x, y) {
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.className = 'heart floating';
        heart.style.left = `${x}px`;
        heart.style.top = `${y}px`;
        heart.style.fontSize = `${Math.random() * 10 + 20}px`;
        document.body.appendChild(heart);

        // Remove the heart element after animation completes
        heart.addEventListener('animationend', () => {
            heart.remove();
        });
    }

    // Add button pulse animation
    function pulseButton() {
        translateBtn.classList.add('button-pulse');
        setTimeout(() => {
            translateBtn.classList.remove('button-pulse');
        }, 300);
    }

    // Create multiple hearts around the button
    function createHearts(event) {
        const buttonRect = translateBtn.getBoundingClientRect();
        const centerX = buttonRect.left + buttonRect.width / 2;
        const centerY = buttonRect.top + buttonRect.height / 2;

        // Create 5-10 hearts
        const numHearts = Math.floor(Math.random() * 6) + 5;
        for (let i = 0; i < numHearts; i++) {
            // Random position around the button
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 50 + 30;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // Delay each heart slightly
            setTimeout(() => {
                createFloatingHeart(x, y);
            }, i * 100);
        }
    }

    // Handle translation
    translateBtn.addEventListener('click', async () => {
        const text = inputText.value.trim();
        
        if (!text) {
            alert('Please enter some text to LinkedInify');
            return;
        }

        // Visual feedback
        pulseButton();
        createHearts();
        
        // Show loading state
        translateBtn.disabled = true;
        outputText.classList.add('loading');
        outputText.textContent = 'Transforming your text...';

        try {
            // Call the API to translate the text
            const token = getToken();
            const response = await fetch('/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                throw new Error('Failed to translate');
            }

            const data = await response.json();
            
            // Display the translated text
            outputText.textContent = data.post || "I'm thrilled to announce that we're embarking on an exciting new journey...";
        } catch (error) {
            console.error('Error:', error);
            outputText.textContent = 'Something went wrong. Please try again.';
        } finally {
            // Reset loading state
            translateBtn.disabled = false;
            outputText.classList.remove('loading');
        }
    });

    // Add some initial example text
    if (!inputText.value) {
        inputText.value = 'We started a new project last week.';
    }
});
