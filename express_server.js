const express = require("express");
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");
const bcrypt = require("bcrypt");
const methodOverride = require('method-override');
const app = express();
const port = process.env.PORT || 8080;

app.set("view engine", "ejs");

app.use(methodOverride('_method'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieSession({
  name: 'session',
  secret: 'cookiemonster',
  maxAge: 24 * 60 * 60 * 1000
}));

var urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

const users = {};
const stats = {};

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

//To create a random string for short URL
function generateRandomString() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomString = "";
  for (let i = 0; i < 6; i++) {
    randomString += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return randomString;
}

function addVisit(shortURL, visitor_id) {
  const date = new Date();
  const dateString = date.toDateString();
  const time = date.toLocaleTimeString("en-US", {timeZone: "America/Los_Angeles"});
  if (stats[shortURL]) {
    let firstVisit = true;
    const visits = stats[shortURL].visits;
    for (const visit of visits) {
      if (visit.visitor_id === visitor_id) {
        firstVisit = false;
        break;
      }
    }
    visits.push({ visitor_id: visitor_id, timeStamp: `${dateString} ${time}` });
    if (firstVisit) {
      stats[shortURL].uniqueVisits += 1;
    }
  } else {
    stats[shortURL] = {
      visits: [{ visitor_id: visitor_id, timeStamp: `${dateString} ${time}` }],
      uniqueVisits: 1
    };
  }
}

function getUsersUrls(user) {
  let urlsByOwner = {};
  for (const url in urlDatabase) {
    if (urlDatabase[url].userID === user.id) {
      urlsByOwner[url] = urlDatabase[url];
    }
  }
  return urlsByOwner;
}

app.get("/", (req, res) => {
  const user = req.session.user_id;
  if (user) {
    res.redirect("/urls");
  } else {
    res.render("front");
  }
});

app.get("/urls", (req, res) => {
  const userCookie = req.session.user_id;
  if (userCookie === undefined) {
    res.render("front");
  } else {
    const user = users[userCookie];
    const usersUrls = getUsersUrls(user);
    const templateVars = {
      urls: usersUrls,
      user: user
    };
    res.render("urls_index", templateVars);
  }
});

app.post("/urls", (req, res) => {
  const id = generateRandomString();
  const userID = req.session.user_id;
  const url = req.body.longURL;
  urlDatabase[id] = { "userID": userID, "longURL": url };
  res.redirect(`/urls/${id}`);
});

app.get("/urls/new", (req, res) => {
  const userCookie = req.session.user_id;
  if (userCookie === undefined) {
    res.redirect("/login");
  } else {
    const user = users[userCookie];
    const templateVars = {
      user: user
    };
    res.render("urls_new", templateVars);
  }
});

app.get("/urls/:id", (req, res) => {
  const userCookie = req.session.user_id;
  if (userCookie === undefined) {
    res.render("front");
  } else {
    const user = users[userCookie];
    const id = req.params.id;
    if (!urlDatabase[id]) {
      res.status(400).send("This URL doesn not exist.");
      return;
    }
    const templateVars = {
      stats: stats,
      urls: urlDatabase,
      user: user,
      shortURL: id
    };
    res.render("urls_show", templateVars);
  }
});

app.get("/u/:shortURL", (req, res) => {
  const visitor_id = req.session.visitor_id;
  const shortURL = req.params.shortURL;
  addVisit(shortURL, visitor_id);
  if (!urlDatabase[shortURL]) {
    res.status(400).send("Short Url does not exist");
    return;
  }
  const longURL = urlDatabase[shortURL].longURL;
  res.redirect(longURL);
});

app.delete("/urls/:id", (req, res) => {
  const currentUser = req.session.user_id;
  if (!currentUser) {
    res.status(400).send("You must log in");
    return;
  }
  const owner = urlDatabase[req.params.id].userID;
  if (currentUser !== owner) {
    res.status(400).send("Sorry! You can delete only your URLs!");
  } else {
    delete urlDatabase[req.params.id];
    res.redirect("/urls");
  }
});

app.put("/urls/:id", (req, res) => {
  const currentUser = req.session.user_id;
  if (!currentUser) {
    res.status(400).send("You must LogIn first.");
    return;
  }
  const shortURL = req.params.id;
  const owner = urlDatabase[shortURL].userID;
  if (currentUser !== owner) {
    res.status(400).send("Sorry! You can only update your URLs!");
  } else {
    delete stats[shortURL];
    urlDatabase[shortURL].longURL = req.body.longURL;
    res.redirect("/urls");
  }
});

app.get("/register", (req, res) => {
  const user = req.session.user_id;
  if (user) {
    res.redirect("/urls");
  } else {
    res.render("register");
  }
});

app.post("/register", (req, res) => {
  const id = generateRandomString();
  const email = req.body.email;
  for (const user in users) {
    if (users[user].email === email) {
      res.status(400).send("Email is Registered before!");
      return;
    }
  }
  const password = req.body.password;
  if (!email || !password) {
    res.status(400).send("Please enter your Email and Password.");
  }
  const hashed_password = bcrypt.hashSync(password, 10);
  users[id] = { id, email, hashed_password };
  req.session.user_id = id;
  res.redirect('/urls');
});


app.get("/login", (req, res) => {
  const user = req.session.user_id;
  if (user) {
    res.redirect("/urls");
  } else {
    res.render("login");
  }
});

app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  if (!email || !password) {
    res.status(400).send("Please Enter your Email and Password");
    return;
  }
  for (const user in users) {
    if (users[user].email === email) {
      if (bcrypt.compareSync(password, users[user].hashed_password)) {
        req.session.user_id = users[user].id;
        res.redirect('/urls');
        return;
      } else {
        res.status(403).send("Something Went Wrong. Please enter you password again.");
        return;
      }
    }
  }
  res.status(403).send("User Information is not stored in the system. Please try again.");
});

app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/urls");
});

//Redirect all other requests to 404
app.get("/*", (req, res) => {
  res.render("404");

});

//To keep a track of Visitor Cookies
app.use(function (req, res, next) {
  if (!req.session.visitor_id) {
    req.session.visitor_id = generateRandomString();
  }
  next();
});