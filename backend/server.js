// filepath: c:\Users\batag\Molengeek\projetHey\backend\server.js
console.log("Starting server.js");

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Token verification at startup
async function verifyToken() {
  const token = process.env.HF_API_TOKEN;
  if (!token) {
    console.error('No API token found in environment variables');
    return false;
  }

  try {
    console.log('Verifying Hugging Face API token...');
    console.log('Making verification request to Hugging Face API...');
    
    // Try to access model info as a token verification method
    const model = process.env.HF_MODEL || 'CarlosRiverMe/sd3-finetuned-aws';
    const response = await fetch(`https://huggingface.co/api/models/${model}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error('Token verification failed. Status:', response.status);
      console.error('Response:', responseText);
      return false;
    }
    
    const data = await response.json();
    console.log('Model verification successful. Model details:', JSON.stringify(data, null, 2));
    console.log('Token verification successful');
    return true;
  } catch (error) {
    console.error('Error verifying token:', error.message);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Serve static files first
app.use(express.static(path.join(__dirname, '../public')));

// Image generation route
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;
  const token = process.env.HF_API_TOKEN;
  const baseModel = "stabilityai/stable-diffusion-3.5-large";
  
  if (!token) {
    console.error('API token not set');
    return res.status(500).json({ success: false, error: 'Server API token not set' });
  }
  
  if (!prompt) {
    console.error('No prompt provided');
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }
  
  try {
    console.log('Starting image generation...');
    console.log('Base model:', baseModel);
    console.log('Prompt:', prompt);
    
    // Add timeout of 2 minutes
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(`https://api-inference.huggingface.co/models/${baseModel}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        inputs: prompt,
        options: {
          use_cache: false,
          wait_for_model: true
        },
        parameters: {
          negative_prompt: "blurry, cropped, ugly",
          width: 768, // Reduced size for faster generation
          height: 512,
          num_inference_steps: 20, // Reduced steps for faster generation
          guidance_scale: 7.5
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('Hugging Face API error status:', response.status);
      const responseText = await response.text();
      console.error('Hugging Face API error details:', responseText);
      return res.status(response.status).json({ 
        success: false, 
        error: `API Error: ${response.status} - ${responseText}` 
      });
    }

    console.log('Response received from Hugging Face API');
    const buffer = await response.buffer();
    console.log('Buffer received, converting to base64...');
    const base64 = buffer.toString('base64');
    console.log('Successfully generated image');
    res.json({ success: true, imageUrl: `data:image/jpeg;base64,${base64}` });
  } catch (error) {
    console.error('Error in generate-image:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ 
        success: false, 
        error: 'Request timeout - Image generation took too long' 
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Default route - serve the HTML file
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/context.html'));
});

// Start server
verifyToken().then(isValid => {
  if (!isValid) {
    console.error('Server startup aborted due to invalid API token');
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Serving static files from: ${path.join(__dirname, '../public')}`);
  });
});