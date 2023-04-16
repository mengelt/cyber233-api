import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/record.js';
import { MongoClient } from 'mongodb';
import { MONGO_URI } from './db/conn.js';

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(apiRoutes);

// Global error handling


// perform a database connection when the server starts
/*
dbo.connectToServer(function (err) {
  if (err) {
    console.error(err);
    process.exit();
  }

  // start the Express server
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
});
*/

async function startServer() {
  try {

    console.log('\nStarting up OneSpace Social API');

    // Connect to MongoDB
    const client = await MongoClient.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB!');
    
    // Use the MongoDB connection in your app
    app.locals.db = client.db('social');

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`Listing on at http://localhost:${PORT}... Let's be social!`);
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

await startServer();