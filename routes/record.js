import express from 'express';
import axios from 'axios';

const JWT_SECRET = 'cyber233-top-secret-key';
const JWT_EXPIRES_IN = 3600 * 24 * 2; // 2 days

// Since we are unable to sign a JWT in a browser
// because "jsonwebtoken" library is available on server side only, NodeJS environment
// we simply simulate a signed token, no complex checks because on server side
// you're using the library
const sign = (payload, privateKey, header) => {
  const now = new Date();
  header.expiresIn = new Date(now.getTime() + header.expiresIn);
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = btoa(Array
    .from(encodedPayload)
    .map((item, key) => (String.fromCharCode(item.charCodeAt(0) ^ privateKey[key
    % privateKey.length].charCodeAt(0))))
    .join(''));

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

// recordRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /listings.
const apiRoutes = express.Router();

// This will help us connect to the database
//const dbo = require("../db/conn");

apiRoutes.route("/test").get(async function (req, res) {

    const items = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' }
    ];
  
    res.status(200).json(items);

});

apiRoutes.route("/login").post(async function (req, res) {

  console.info('req', req.body)

  const user = { 
    email: req.body.email,
    password: req.body.password
  };

  console.info('01 reaching out to token server for login', user)
  let tokenResponse = await axios.post('http://localhost:5001/login', user);

  if ( 'user' in tokenResponse.data ) {
    console.info('user verified');

    const jwt = sign(tokenResponse.data.user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(200).json({ token: jwt });
    
  } else {
    res.status(401).json({ error: 'Invalid email and/or password.' });
  }

})

apiRoutes.route("/register").post(async function (req, res) {

    console.info('req', req.body)

    const user = { 
        name: req.body.name, 
        email: req.body.email,
        password: req.body.password
    };

    // exchange token for PII
    console.info('01 reaching out to token server with', user)
    let tokenResponse = await axios.post('http://localhost:5001/token', user);
    
    if ( 'token' in tokenResponse.data ) {

      let userToken = tokenResponse.data.token;
    
      // insert a user table record with the user token and when they registered
      
      const db = req.app.locals.db;
      const tokensCollection = db.collection('users');
      const result = await tokensCollection.insertOne({ token: userToken, dateAdded: new Date() });

      const jwt = sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.status(200).json({ token: jwt });
  
    } else {
      console.info('private api did not return a user token')
      res.status(500).json({ error: 'Internal Server Error' });
    }


});


export default apiRoutes;
