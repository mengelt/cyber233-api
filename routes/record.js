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


const decode = (token) => {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  const header = JSON.parse(atob(encodedHeader));
  const payload = JSON.parse(atob(encodedPayload));
  const now = new Date();

  if (now < header.expiresIn) {
    throw new Error('Expired token');
  }
  return payload;
};

// recordRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /listings.
const apiRoutes = express.Router();



apiRoutes.route("/feed").get(async function (req, res) {

  // get email from jwt
  let bearerToken = '';
  let decodedToken = null;
  const bearerHeader = req.headers['authorization'];
  
  res.status(200)
  if (typeof bearerHeader !== 'undefined') {
    bearerToken = bearerHeader.split(' ')[1];
    decodedToken = decode(bearerToken);
    // TODO: Use the bearer token to authenticate the user
  } else {
    // Return a 401 Unauthorized response if the bearer token is missing
    res.status(401).json({ error: 'bearer token not found in /feed request' });
  }
  
  
  // exchange user token for the email
  let email = {email: decodedToken.email};
  let userToken = "";
  await axios.post('http://localhost:5001/exchange', email)
  .then(async (tokenResponse) => {
    userToken = tokenResponse.data.token;
  });  
  
  
  
  // get friends of that token
  let token = {token: userToken};
  let friends = [];
  await axios.post('http://localhost:5001/friends', token)
    .then(async (tokenResponse) => {

      if ( tokenResponse.status === 200 ) {
        
        if ( 'friends' in tokenResponse.data && tokenResponse.data.friends.length > 0 ) {
          console.info('added friends')
          friends = tokenResponse.data.friends;
        }
      }
      
    }); 

  friends.push(userToken);

    // get the translated user values for the feed
    let users = [];
    await axios.post('http://localhost:5001/exchangeTokensForIdentity', {tokens: friends})
      .then(async (userResponse) => {
        if ( userResponse.status === 200 ) {
          users = userResponse.data;
          
        } else {
          console.error('could not retrieve identities for tokens')
        }
    });




  const db = req.app.locals.db;
  const collection = db.collection('posts'); // Replace 'your_collection_name' with the actual collection name.

  // Query the collection for documents where the field value is in the keySet
  const query = { token: { $in: friends } };
  const documents = await collection.find(query).toArray();
  

  let sortedDocuments = documents.map(doc => {
    let identity = users.find(f => f.token === doc.token);
    return {...doc, 
            identity: {...identity},
            sortableDate: new Date(doc.dateAdded).getTime()
    }
  })

  sortedDocuments = sortedDocuments.sort( (a,b) => b.sortableDate - a.sortableDate)


  
  res.status(200).json(sortedDocuments);
  /*
  // create a set of tokens

  // get all posts for all tokens in the set

  // order posts by most recent

  // return results
  res.status(200).json({ friends });
  */
})

apiRoutes.route("/post").post(async function (req, res) {

  const post = req.body.post;

  console.info('/n * user posting')
  let bearerToken = '';
  let decodedToken = null;
  const bearerHeader = req.headers['authorization'];
  if (typeof bearerHeader !== 'undefined') {
    bearerToken = bearerHeader.split(' ')[1];
    decodedToken = decode(bearerToken);
    // TODO: Use the bearer token to authenticate the user
  } else {
    // Return a 401 Unauthorized response if the bearer token is missing
    
    res.sendStatus(401);
  }

  // decode email from jwt, get token from token server, insert into posts collection using token

  console.info('decodedToken', decodedToken)

  let email = {email: decodedToken.email}

  axios.post('http://localhost:5001/exchange', email)
    .then(async (tokenResponse) => {
      console.info(tokenResponse.data)

      let userToken = tokenResponse.data.token;
      // make the entry into the posts collection

      const db = req.app.locals.db;
      const postsCollection = db.collection('posts');

      const result = await postsCollection.insertOne({ token: userToken, post, dateAdded: new Date() });

      res.sendStatus(200)
    })
    .catch(e => {
      console.info('error', e)
      res.sendStatus(500)
    });



  
})

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
