const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Treblle monitoring active`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`🌐 To expose via ngrok: npx ngrok http ${PORT}`);
});