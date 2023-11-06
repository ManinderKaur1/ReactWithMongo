import fs from "fs";
import admin from "firebase-admin";
import express from "express";
import { MongoClient } from "mongodb";

const credentials = JSON.parse(fs.readFileSync("./credentials.json"));
admin.initializeApp({
  credential: admin.credential.cert(credentials),
});
const app = express();
app.use(express.json());

app.use(async (req, res, next) => {
  const { authtoken } = req.headers;
  if (authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (e) {
     return res.sendStatus(400);
    }
  }
  req.user = req.user || {};
  next();
});

app.get("/api/articles/:name", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;
  const client = new MongoClient("mongodb://127.0.0.1:27017");
  await client.connect();
  const db = client.db("react-blog-db");
  const article = await db.collection("articles").findOne({ name });

  if (article) {
    const upvoteIds = article.upvoteIds || [];
    article.canUpvote = uid && !upvoteIds.includes(uid);
    res.json(article);
  } else {
    res.statusCode(404);
  }
});

app.use((req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.sendStatus(401);
  }
});

app.put("/api/articles/:name/upvote", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  const client = new MongoClient("mongodb://127.0.0.1:27017");
  await client.connect();
  const db = client.db("react-blog-db");

  const article = await db.collection("articles").findOne({ name });

  if (article) {
    const upvoteIds = article.upvoteIds || [];
    const canUpvote = uid && !upvoteIds.includes(uid);

    if (canUpvote) {
      await db.collection('articles').updateOne({ name }, {
          $inc: { upvotes: 1 },
          $push: { upvoteIds: uid },
        });
    }
    const updatedArticle = await db.collection('articles').findOne({ name });
    res.json(updatedArticle );
  } else {
    res.send("That article doesn't exist");
  }
});

app.post("/api/articles/:name/comments", async (req, res) => {
  const { name } = req.params;
  const { postedBy, text } = req.body;
  const { email } = req.user;

  const client = new MongoClient("mongodb://127.0.0.1:27017");
  await client.connect();
  const db = client.db("react-blog-db");
  await db.collection("articles").updateOne(
    { name },
    {
      $push: { comments: { postedBy: email, text } },
    }
  );

  const article = await db.collection("articles").findOne({ name });
  if (article) {
    res.json(article);
  } else {
    res.send("That article doesn't exist");
  }
});

app.listen(8000, () => {
  console.log("server is litening on port 8000");
});
