//We load the dotenv library and call the config method, which loads the variables into the process.env
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

//Initializing the session
app.use(session({
    secret: "Our Little Secret.",
    resave: false,
    saveUninitialized: false
}));

// initialize is a method that comes bundled with passport and sets up passport for us to start using it for authentication.
app.use(passport.initialize());
app.use(passport.session());
// Tell the app to use passport to also setup/manage our session.

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
/* "passportLocalMongoose" is going to used to hash and salt our passwords and to save our users into our MongoDB database.
It's going to do a lot of heavy lifting for us.*/

userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

//Using passport-local-mongoose to create a local strategy
passport.use(User.createStrategy());

/** Supports session for local strategy 
//Serialize and deserialize is only necessary when we are using sessions.
passport.serializeUser(User.serializeUser());
//Serialize the user creates identiciication and stuffs into the cookie.
passport.deserializeUser(User.deserializeUser());
//Deserialize the user allows the passport to be able to look into cookies and look who the user is by authenication.
*/

// Support sessions for all authentication strategies - Third party OAuth 
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

//Passport Google Strategy
passport.use(new GoogleStrategy({
    //Passing all these options helps google to recognise our app which was setup in Google API dashboard
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        //findorCreate is a pseudo/fake code created by passport which does nothing but to make it work there is package "findorCreate"
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate('google', { scope: ["profile"] }));
/*Use the passport to autheniticate user using google strategy and scope - check for their email and id on google servers.
This code is enough for the pop-up of google-sign and check authentication*/

/*After Google Authentication, google makes GET request to this route to redirect the user 
which should match the mentioned route URL in Google API dashboard*/
app.get("/auth/google/secrets",
    passport.authenticate('google', { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect to secrets.
        res.redirect('/secrets');
    });

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/login", function (req, res) {
    res.render("login");
});

//Allow anyone to see secrets of everyone, so remove authentication for this route
app.get("/secrets", function (req, res) {
    //Find the users who's secret field is not equal to null
    User.find({ secret: { $ne: null } }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                res.render("secrets", { usersWithSecrets: foundUsers });
            }
        }
    });
});

app.get("/submit", function (req, res) {
    //if the request (username, password) is authenicated, then render the submit page
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function () {
                    res.redirect("/secrets");
                });
            }
        }
    });
});

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            // passport.authenticate is to authenicate the user and the type of authentication that we're performing is local. And then once we've authenticated them, we're going to again open a set of parentheses and we're going to pass in req, res and a callback.And this callback is only triggered if the authentication was successful and we managed to successfully setup a cookie that saved their current logged in session so will you have to check to see if they're logged in or not. 
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
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

            /**If there were no errors then we're going to authenticate our user so it means that they've successfully logged in and we're going to call passport.authenticate and we're going to use the local strategy. */

            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");

                /**Our user is authenicated using their password and username. And if we've successfully authenticated them then again we're going to redirect them to the secrets route, where we of course check whether if they are indeed authenticated or not. So both when they've successfully registered and when they've successfully logged in using the right credentials, we're going to send a cookie and tell the browser to hold onto that cookie because the cookie has a few pieces of information that tells our server about the user, namely that they are authorized to view any of the pages that require authentication. */
            });
        }
    });
});

app.listen(3000, function () {
    console.log("Server has started on port 3000.");
});