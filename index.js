require('dotenv').config({ path: './sample.env' });
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dns = require('dns');
const validUrl = require('valid-url');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));
// Define URL schema
const urlSchema = new mongoose.Schema({
  originalUrl: String,
  shortUrl: String,
});
const Url = mongoose.model('Url', urlSchema);

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Helper function to validate domain existence
function checkDomainExists(url, callback) {
  const domain = new URL(url).hostname;
  dns.lookup(domain, (err) => {
    callback(!err); // If there's no error, the domain exists
  });
}

app.post('/api/shorturl', async (req, res) => {
  console.log(req.body);
  let { url } = req.body;

  if (!/^https?:\/\//i.test(url)) {
    return res.json({ error: 'invalid url' });
  }

  if (!validUrl.isUri(url)) {
    return res.status(400).json({ error: 'invalid url' });
  }

  try {
    const hostname = new URL(url).hostname;

    // Perform DNS lookup
    dns.lookup(hostname, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'invalid url' });
      }

      try {
        // Check if the URL already exists in the database
        let existingUrl = await Url.findOne({ originalUrl: url });
        if (existingUrl) {
          return res.json({ original_url: existingUrl.originalUrl, short_url: existingUrl.shortUrl });
        }

        // Create a new short URL
        const shortUrlId = nanoid(8);
        const newUrl = new Url({
          originalUrl: url,
          shortUrl: shortUrlId,
        });
        await newUrl.save();

        res.json({ original_url: url, short_url: shortUrlId });
      } catch (dbError) {
        res.status(500).json({ error: 'Database error' });
      }
    });
  } catch (e) {
    return res.status(400).json({ error: 'invalid url' });
  }
});


// GET endpoint for redirecting
app.get('/api/shorturl/:shortened', async (req, res) => {
  const { shortened } = req.params;

  try {
    const url = await Url.findOne({ shortUrl: shortened });
    if (!url) {
      return res.status(404).json({ error: 'Shortened URL not found' });
    }
    res.redirect(url.originalUrl);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
