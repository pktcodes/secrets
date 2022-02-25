//jshint esversion:6
//We load the dotenv library and call the config method, which loads the variables into the process.env
require("dotenv").config(); 
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));


mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String
});

userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});

const User = mongoose.model("User", userSchema);

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/register", function (req, res) {

    const newUser = new User({
        email: req.body.username,
        password: req.body.password
    });

    newUser.save(function (err) {
        if (!err) {
            res.render("secrets");
        } else {
            console.log(err);
        }
    });
});

app.post("/login", function (req, res) {
    const email = req.body.username;
    const password = req.body.password;

    User.findOne({ email: email }, function (err, foundResult) {
        if (!err) {
            if (foundResult) {
                if (foundResult.password === password) {
                    res.render("secrets");
                }
            }
        } else {
            console.log(err);
        }
    });
});

app.listen(3000, function () {
    console.log("Server has started on port 3000.");
});