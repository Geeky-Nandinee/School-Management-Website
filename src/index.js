const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { collection, Task, Quiz, SECRET_KEY } = require('./config');
const app = express();

app.use(cookieParser());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static("public"));

function verifyToken(req, res, next) {
    const token = req.cookies && req.cookies.jwt;
    if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ message: "Invalid token" });
    }
}

// Routes
app.get("/", (req, res) => {
    res.render('login');
});

app.get("/admin_login", (req, res) => {
    const school = req.query.school;
    res.render('admin_login', { school });
});

app.get("/super_admin", (req, res) => {
    res.render('super_admin');
});

app.post("/super_admin", (req, res) => {
    const selectedSchool = req.body.school;
    res.redirect(`/school_admin/${selectedSchool}`);
});

// Select school route
app.post("/select-school", (req, res) => {
    const selectedSchool = req.body.school;
    res.redirect(`/admin_login?school=${selectedSchool}`);
});

app.get("/signup", (req, res) => {
    const school = req.query.school || '';
    const role = req.query.role || 'student';
    res.render('signup', { school, role });
});

app.post("/signup", async (req, res) => {
    try {
        const data = {
            name: req.body.username,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
            medium: req.body.medium,
            standard: req.body.standard,
            school: req.body.school
        };

        const existUser = await collection.findOne({ name: data.name });
        if (existUser) {
            return res.status(400).json({ message: "User already exists. Please choose a different Username" });
        } else {
            const saltRounds = 10;
            const hashPassword = await bcrypt.hash(data.password, saltRounds);
            data.password = hashPassword;

            const userdata = await collection.insertMany(data);
            console.log(userdata);
            res.redirect(`/school_admin/${data.school}`);
        }
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "An error occurred during signup" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { username, password, school } = req.body;
        const user = await collection.findOne({ 
            name: username, 
            school: school 
        });

        if (!user) {
            return res.status(404).json({ message: "User not found for this school" });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (isPasswordMatch) {
            const token = jwt.sign({ _id: user._id, role: user.role, school: user.school }, SECRET_KEY);

            res.cookie("jwt", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // use secure cookies in production
                maxAge: 24 * 60 * 60 * 1000
            });

            switch(user.role) {
                case 'admin':
                    return res.redirect(`/school_admin/${school}`);
                case 'student':
                    return res.redirect(`/student_dashboard/${user._id}`);
                case 'teacher':
                    return res.redirect(`/teacher_dashboard/${user._id}`);
                default:
                    return res.status(400).json({ message: "Invalid role" });
            }
        } else {
            return res.status(401).json({ message: "Wrong password" });
        }
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "An error occurred during login" });
    }
});

app.get("/school_admin/:school", async (req, res) => {
    try {
        const school = req.params.school;
        const students = await collection.find({ role: 'student', school: school }).lean();
        const teachers = await collection.find({ role: 'teacher', school: school }).lean();
        const availableSubjects = ['Mathematics', 'Science', 'English', 'History', 'Gujarati', 'Hindi', 'Sanskrit'];

        res.render('school_admin', { school, students, teachers, availableSubjects });
    } catch (error) {
        console.error("Error fetching school data:", error);
        res.status(500).send('Server error');
    }
});


app.get("/student_module", verifyToken, async (req, res) => {
    try {
        const students = await collection.find({ role: 'student' }).lean();
        console.log('Students:', students);
        res.render('student_module', { students });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
});

app.get("/teacher_module", verifyToken, async (req, res) => {
    try {
        const teachers = await collection.find({ role: 'teacher' }).lean();
        console.log('Teachers:', teachers);
        res.render('teacher_module', { teachers });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
});

// app.get("/api/student/:id", verifyToken, async (req, res) => {
//     try {
//         console.log(req.params.id)
//         const student = await collection.findOne({ _id: req.params.id, role: 'student' });
//         if (!student) {
//             return res.status(404).json({ message: "Student not found" });
//         }
//         res.json(student);
//     } catch (error) {
//         console.error("Error fetching student:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// });

// app.get('/api/teacher/:id', verifyToken, async (req, res) => {
//     try {
//         console.log(req.params.id)
//         const teacher = await collection.findById(req.params.id);

//         if (!teacher) {
//             return res.status(404).send('Teacher not found');
//         }
//         res.json(teacher);
//         console.log("Teacher found", teacher);
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Server error');
//     }
// });

app.get('/student/:id', async (req, res) => {
    try {
        console.log("Fetching student with ID:", req.params.id);
        const student = await collection.findOne({ _id: req.params.id, role: 'student' });
        console.log("Found student:", student);
        
        if (!student) {
            console.log("No student found with ID:", req.params.id);
            return res.status(404).send('Student not found');
        }
        res.render('student_detail', { student });
    } catch (err) {
        console.error("Error fetching student:", err);
        res.status(500).send('Server error');
    }
});

app.get('/teacher/:id', async (req, res) => {
    try {
        console.log("Fetching teacher with ID:", req.params.id);
        const teacher = await collection.findOne({ _id: req.params.id, role: 'teacher' });
        console.log("Found teacher:", teacher);
        
        if (!teacher) {
            console.log("No teacher found with ID:", req.params.id);
            return res.status(404).send('Teacher not found');
        }
        res.render('teacher_detail', { teacher });
    } catch (err) {
        console.error("Error fetching teacher:", err);
        res.status(500).send('Server error');
    }
});

// app.get('/api/student_dashboard/:id', verifyToken, async (req, res) => {
//     try {
//         console.log("Attempting to fetch student with ID:", req.params.id);
//         const student = await collection.findById(req.params.id);
        
//         if (!student) {
//             console.log("Student not found for ID:", req.params.id);
//             return res.status(404).json({ message: 'Student not found' });
//         }

//         console.log("Found student:", student);

//         const dashboardData = {
//             school: student.school,
//             name: student.name,
//             email: student.email,
//             role: student.role,
//             medium: student.medium,
//             standard: student.standard,
//         };

//         res.json({
//             success: true,
//             data: dashboardData
//         });
//     } catch (error) {
//         console.error("Error in student dashboard route:", error);
//         res.status(500).json({ 
//             success: false, 
//             message: 'Server error', 
//             error: error.message 
//         });
//     }
// });

// app.get('/api/teacher_dashboard/:id', verifyToken, async (req, res) => {
//     try {
//         console.log("Attempting to fetch teacher with ID:", req.params.id);
//         const teacher = await collection.findById(req.params.id);
        
//         if (!teacher) {
//             console.log("Teacher not found for ID:", req.params.id);
//             return res.status(404).json({ 
//                 success: false, 
//                 message: 'Teacher not found' 
//             });
//         }
        
//         console.log("Found teacher:", teacher);

//         const dashboardData = {
//             name: teacher.name,
//             email: teacher.email,
//             subjects: teacher.subjects || [],
//         };

//         const availableSubjects = ['Mathematics', 'Science', 'English', 'History', 'Gujarati', 'Hindi', 'Sanskrit'];

//         res.json({
//             success: true,
//             data: {
//                 teacher: dashboardData,
//                 availableSubjects: availableSubjects
//             }
//         });
//     } catch (error) {
//         console.error("Error in teacher dashboard API:", error);
//         res.status(500).json({ 
//             success: false, 
//             message: 'Server error', 
//             error: error.message 
//         });
//     }
// });


app.get("/student_dashboard/:id", verifyToken, async (req, res) => {
    try {
        const student = await collection.findOne({ _id: req.params.id, role: 'student' });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const tasks = await Task.find({ 
            school: student.school, 
            dueDate: { $gt: new Date() }
        });

        const quizzes = await Quiz.find({ 
            school: student.school, 
            dueDate: { $gt: new Date() }
        });

        res.render('student_dashboard', { student, tasks, quizzes });
    } catch (error) {
        console.error("Error fetching student data:", error);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/teacher_dashboard/:id", verifyToken, async (req, res) => {
    try {
        const teacher = await collection.findOne({ _id: req.params.id, role: 'teacher' });
        if (!teacher) {
            return res.status(404).json({ message: "Teacher not found" });
        }
        const availableSubjects = ['Mathematics', 'Science', 'English', 'History', 'Gujarati', 'Hindi', 'Sanskrit'];
        res.render('teacher_dashboard', { teacher, availableSubjects });
    } catch (error) {
        console.error("Error fetching teacher:", error);
        res.status(500).json({ message: "Server error" });
    }
});


app.post('/assign_subject/:id', verifyToken, async (req, res) => {
    try {
        const teacherId = req.params.id;
        const subject = req.body.subject;
        
        const teacher = await collection.findByIdAndUpdate(
            teacherId,
            { $addToSet: { subjects: subject } },
            { new: true }
        );

        if (!teacher) {
            return res.status(404).send('Teacher not found');
        }
        res.redirect(`/teacher_dashboard/${teacherId}`);
    } catch (error) {
        console.error("Error assigning subject:", error);
        res.status(500).send('Server error');
    }
});

app.post('/create-task', verifyToken, async (req, res) => {
    try {
        const { name, description, dueDate, school } = req.body;
        const task = new Task({
            name,
            description,
            school,
            dueDate: new Date(dueDate)
        });
        await task.save();
        res.status(201).json({ message: 'Task created for the school', task });
    } catch (error) {
        res.status(500).json({ message: 'Error creating task', error });
    }
});

app.post('/create-quiz', verifyToken, async (req, res) => {
    try {
        const { name, description, dueDate, school, questions } = req.body;
        const quiz = new Quiz({
            name,
            description,
            school,
            dueDate: new Date(dueDate),
            questions
        });
        await quiz.save();
        res.status(201).json({ message: 'Quiz created for the school', quiz });
    } catch (error) {
        res.status(500).json({ message: 'Error creating quiz', error });
    }
});

app.post('/complete-task/:taskId', verifyToken, async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.taskId, { completed: true }, { new: true });
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        res.json({ success: true, message: 'Task marked as complete' });
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

const port = 5000;
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});