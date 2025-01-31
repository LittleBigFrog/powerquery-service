// index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DefaultSettings, TaskUtils } from '@microsoft/powerquery-parser';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

async function parseSingleQuery(pqCode) {
    if (typeof pqCode !== 'string' || pqCode.trim().length === 0) {
        throw new Error('Invalid input: Expected non-empty Power Query string');
    }

    const task = await TaskUtils.tryLexParse(DefaultSettings, pqCode);
    
    if (!TaskUtils.isParseStageOk(task)) {
        throw new Error('Parsing failed - invalid Power Query syntax');
    }

    return task.ast;
}

// API endpoint
app.post('/parse', async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Missing "code" in request body' });
        }

        const ast = await parseSingleQuery(code);
        res.json({ ast });
        
    } catch (error) {
        const status = error.message.includes('invalid') ? 422 : 500;
        res.status(status).json({ 
            error: error.message,
            details: error.stack?.split('\n')[0] 
        });
    }
});

app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});
