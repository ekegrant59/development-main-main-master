require('dotenv').config()
const express = require('express') 
const ejs = require('ejs')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const session = require('express-session')
// const adminschema = require('./schema/adminschema')
const userschema = require('./schema/userschema')
const balanceSchema = require('./schema/balanceSchema')

const hbs = require('nodemailer-express-handlebars')
const nodemailer = require('nodemailer')
const path = require('path')

const adminkey = process.env.ADMINKEY
const secretkey = process.env.SECRETKEY

const mongodb = process.env.MONGODB
mongoose.connect(mongodb)
.then(() => {
   console.log('Connection successful')
}).catch((err) => {
    console.log(err, "Connection failed")
})

const app = express()
app.use('/assets', express.static('assets')) 
app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: true}))
app.use(cookieParser())
app.use(express.json())
app.use(
    session({
      resave: false,
      saveUninitialized: true,
      secret: 'secret',
    })
);

app.use(require('connect-flash')());
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});

var transporter = nodemailer.createTransport(
    {
        host: process.env.EMAIL_HOST,
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    }
);

// point to the template folder
const handlebarOptions = {
    viewEngine: {
        partialsDir: path.resolve('./views/'),
        defaultLayout: false,
    },
    viewPath: path.resolve('./views/'),
};

// use a template file with nodemailer
transporter.use('compile', hbs(handlebarOptions))

app.get('/', function(req,res){ 
    res.render('home')
})

app.get('/about', function(req,res){ 
    res.render('about')
})

app.get('/pricing', function(req,res){ 
    res.render('pricing')
})

app.get('/signup', function(req,res){ 
    let refferer = ""

    res.render('signup', {referrer: refferer})
})

app.get('/terms', function (req, res) {
  res.render('terms');
});


app.get('/dashboard',protectRoute, function (req, res) {
  res.redirect('https://dashboard.alpeada.com/')
});

app.get('/invite/:id', (req,res)=>{
    let refferer = req.params.id

    res.render('signup', {referrer: refferer})
})

app.get('/verify/:id', async function(req,res){ 
    let id = req.params.id
    verifiedemail(id)
    const theuser = await userschema.findOne({_id: id})
    const name = theuser.firstName + ' ' +  theuser.lastName
    res.render('verSuccess', {name: name})
})

async function verifiedemail(id){
    const theuser = await userschema.findOne({_id: id})
    const name = theuser.firstName + ' ' +  theuser.lastName
    const email = theuser.email

    const mailOptions = {
        from: '"Alpeada" support@alpeada.com ', // sender address
        template: "verifiedemail", // the name of the template file, i.e., email.handlebars
        to: `${email}`,
        subject: 'Successful Verification - Your Trading Account is Ready!',
        context: {
          name: name,
        },
      };
      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.log(`Nodemailer error sending email to ${email}`, error);
      }
}

async function verifyemail(email){
    const theuser = await userschema.findOne({email: email})
    const id = theuser.id
    const name = theuser.firstName + ' ' +  theuser.lastName

    // console.log(id, email, name)

    const mailOptions = {
        from: '"Alpeada" support@alpeada.com ', // sender address
        template: "email", // the name of the template file, i.e., email.handlebars
        to: `${email}`,
        subject: 'Please Verify Your Registration on Alpeada',
        context: {
          name: name,
          id: id
        },
      };
      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.log(`Nodemailer error sending email to ${email}`, error);
      }
}

app.post('/signup', async (req,res)=>{
    const details = req.body
    const password11 = details.password11
    const password22 = details.password22
    const email = details.email

    const date = new Date().toLocaleDateString()
    // console.log(date)
    

    userschema.findOne({email: email}, (err, details)=>{
        if(details){
            req.flash('danger', 'This Email Has Already Been Used')
            res.redirect('/signup')
        }else{
            if ( password11 != password22){
                req.flash('danger', 'Your Passwords Do Not Match')
                res.redirect('/signup')
            }else {
                registerUser()
            }
        } 
    })


    async function registerUser(){
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password11,salt)
        const number = "+" + details.country +" "+ details.number
        try{
            const user = new userschema({
                firstName: details.firstName,
                lastName: details.lastName,
                email: details.email,
                encryptedpassword: hashedPassword,
                password: password11,
                number: number,
                date: date,
                refferal: details.refferal
            })
            await user.save()

            const balance = new balanceSchema({
                name: `${details.firstName} ${details.lastName}`,
                email: details.email,
                balance: 0.00,
                deposit: 0.00,
                withdrawal: 0.00,
                profit: 0.00,
                bot: false
            })
            await balance.save()
            verifyemail(email)

            // console.log(user)
            req.flash('success', 'Sign Up Successfully, Verification Link Sent To Your Email!')
            res.redirect('/signup')
        }catch(err){
            console.log(err)
        }

    }

})

app.post('/login', (req,res)=>{
    const loginInfo = req.body

    const email = loginInfo.email
    const password = loginInfo.password

    userschema.findOne({email})
    .then((user)=>{
        userschema.findOne({email: email}, (err, details)=>{
            if (!details){
                req.flash('danger', 'User Does Not Exist, Please Try Again')
                res.redirect('/signup')
            } else {
                bcrypt.compare(password, user.encryptedpassword, async (err,data)=>{
                    if (data){
                        const payload = {
                            user: {
                                email: user.email
                            }
                        }
                        const token = jwt.sign(payload, secretkey,{
                            expiresIn: '7200s'
                        })
    
                        res.cookie('logintoken', token, {
                            httpOnly: false,
                           domain: 'alpeada.com'
                        })
    
                        res.redirect('https://dashboard.alpeada.com/')
                        // console.log('Login Sucessful')
                        // req.flash('success', 'Login Up Successful')
                        // res.redirect('http://localhost:9000/')
                    } else {
                        req.flash('danger', 'Incorrect Password, Please Try Again!')
                        res.redirect('/signup')
                    }
                })
            }
        } )
    }).catch((err)=>{
        console.log(err)
    })
})

function protectRoute(req, res, next){
    const token = req.cookies.logintoken
    try{
        const user = jwt.verify(token, secretkey)
  
        req.user = user
        // console.log(req.user)
        next()
    }
    catch(err){
        res.clearCookie('logintoken')
        req.flash('danger', 'Session Expired, Please Sign In')
        return res.redirect('/signup')
    }
  }

const port = process.env.PORT || 5000

app.listen(port, ()=>{
    console.log(`App started on port ${port}`)
} )