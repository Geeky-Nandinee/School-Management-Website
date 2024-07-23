const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const SECRET_KEY = "MY_SECRET_KEY";

const connect = mongoose.connect("mongodb+srv://SchoolWebsite:SchoolWebsite0209@schoolwebsite.ripvpii.mongodb.net/?retryWrites=true&w=majority&appName=SchoolWebsite");

connect.then(() => {
    console.log("Database connected successfully");
}).catch(() => {
    console.log("Database connection failed");
});

const LoginSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin'],
        required: true
    },
    medium: {
        type: String,
        required: true
    },
    standard: {
        type: String,
        required: true
    },
    subjects: {
        type: [String],
        default: [],
        required: function() { return this.role === 'teacher'; }
    },
    school:{
        type: String
    },
    tokens:[
        {
            token:{
                type: String,
                required: true
            }
        }
    ]
});

// New schema for tasks
const TaskSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    school: {
        type: String,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    }
});

const QuizSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    school: {
        type: String,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    questions: [{
        question: String,
        options: [String],
        correctAnswer: Number
    }]
});

//we are generating token
LoginSchema.methods.generateAuthToken = async function() {
    try{
        let token = jwt.sign({ _id: this._id, }, SECRET_KEY);
        this.tokens = this.tokens.concat({token : token });
        await this.save();
        return token;
    }
    catch(err){
        console.log(err);
    }
};

const collection = mongoose.model("users", LoginSchema);
const Task = mongoose.model("tasks", TaskSchema);
const Quiz = mongoose.model("quizzes", QuizSchema);

module.exports = { collection, Task, Quiz, SECRET_KEY };