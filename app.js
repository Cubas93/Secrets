//jshint esversion:6

// dependencies
require('dotenv').config();

const express = require("express");
const mongoose = require("mongoose");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://Admin-D:<123.Probando>@secrets.rgel4.mongodb.net/userDB?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
client.connect(err => {
    const collection = client.db("userDB").collection("users");
    // perform actions on the collection object
    client.close();
});

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//mongoose.connect("mongodb://localhost:27017/userDB", {
//    useUnifiedTopology: true,
//    useNewUrlParser: true
//});
//mongoose.set("useCreateIndex", {
//    sparse: true
//});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: [], //Made secret be an array to hold more than 1 if the user chooses to.

});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"

    },
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({
            googleId: profile.id,
            username: profile.id
        }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/auth/google",
    passport.authenticate("google", {
        scope: [
            "profile"
        ]
    })
);

app.get("/auth/google/secrets",
    passport.authenticate("google", {
        failureRedirect: "/login"
    }),
    function (req, res) {
        //Successful authentication, redirect home.
        res.redirect("/secrets");
    }
);

passport.use(new FacebookStrategy({
        clientID: process.env.FAPP_ID,
        clientSecret: process.env.FAPP_SECRET,
        callbackURL: "http://localhost:3000/auth/facebook/secrets",
        profileFields: ["id", "displayName"]


    },
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({
            facebookId: profile.id,
            username: profile.id
        }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/auth/facebook",
    passport.authenticate("facebook"));

app.get("/auth/facebook/secrets",
    passport.authenticate("facebook", {
        failureRedirect: "/login"
    }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/secrets");
    });
//Home
app.get("/", function (req, res) {
    res.render("home");
});
//Login
app.get("/login", function (req, res) {
    res.render("login");
});
//Register
app.get('/register', function (req, res) {
    res.render("register");
});

app.post("/register", function (req, res) {
    User.register({
        username: req.body.username
    }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
        }
    })

});

app.get("/secrets", function (req, res) {
    User.find({
        "secret": {
            $ne: null
        }
    }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                res.render("secrets", {
                    usersWithSecrets: foundUsers
                });
            }
        }
    });
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;

    console.log(req.body.id);

    User.findById(req.user.id, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                foundUsers.secret.push(submittedSecret);
                foundUsers.save(function () {
                    res.redirect("/secrets");
                });
            }
        }
    });
});

app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
        }
    });
});

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

app.listen(3000, function () {
    console.log("Server on 3000");
});