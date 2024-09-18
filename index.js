const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 9000;
const app = express();
require('dotenv').config();
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');


app.use(cors());
app.use(express.json());



const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ac-dczafpo-shard-00-00.ylujpzf.mongodb.net:27017,ac-dczafpo-shard-00-01.ylujpzf.mongodb.net:27017,ac-dczafpo-shard-00-02.ylujpzf.mongodb.net:27017/?ssl=true&replicaSet=atlas-ul1323-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

 // Send email
const sendEmail = (emailAddress, emailData) => {
    //Create a transporter
    const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'mehediweb2023@gmail.com',
        pass: 'zqoq ract zcqi jxfm',
    },
    })

    //verify connection
    transporter.verify((error, success) => {
        if (error) {
            console.log(error)
        } else {
            console.log('Server is ready to take our emails', success)
        }
    })

    const mailBody = {
    from: process.env.MAIL,
    to: emailAddress,
    subject: emailData?.subject,
    html: `<p>${emailData?.message}</p>`,
    }

    transporter.sendMail(mailBody, (error, info) => {
        if (error) {
            console.log(error)
        } else {
            console.log('Email sent: ' + info.response)
        }
    })
}


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
    

async function run() {
    try {

        const usersCollection = client.db('bistroBossDB').collection('users')
        const menuCollection = client.db('bistroBossDB').collection('menu')
        const reviewsCollection = client.db('bistroBossDB').collection('reviews')
        const cartsCollection = client.db('bistroBossDB').collection('carts')
        const paymentCollection = client.db("bistroBossDB").collection("payments");

        //jwt related API
        app.post('/jwt', async(req, res) =>{
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '356d'
            })
            res.send({token})
        })

        //middlewares
        const verifyToken = (req, res, next) =>{
            console.log('inside the verify token', req.headers.authorization);
            if(!req.headers.authorization){
                return res.status(401).send({message: 'unauthorized access'})
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
                if(err){
                    return res.status(401).send({message: 'unauthorized access'})
                }
                req.decoded = decoded;
                next();
            })
        }

        //use verify admin after verifyToken
        const verifyAdmin = async(req, res, next)=>{
            const email = req.decoded.email;
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if(!isAdmin){
                return res.status(403).send({message: 'forbidden access'})
            }
            next();
        }

        //users related API
        app.get('/users', verifyToken, verifyAdmin, async(req, res) =>{
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async(req, res) =>{
            const email = req.params.email;

            if(email !== req.decoded.email){
                return res.status(403).send({message: 'forbidden access'})
            }

            const query = {email: email}
            const user = await usersCollection.findOne(query);
            let admin = false;
            if(user){
                admin = user?.role === 'admin';
            }
            res.send({admin})
        })


        app.post('/users', async(req, res) =>{
            const users = req.body;

            //insert email if user dosent exists:
            //you can do this  many ways (1.email unique, 2. upsert, 3. simple checking)

            const query = {email: users.email}
            const existingUser = await usersCollection.findOne(query);
            if(existingUser){
                return res.send({message: 'user already exist', insertedId: null})
            }

            const result = await usersCollection.insertOne(users);
            res.send(result);
        })
        
        app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) =>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await usersCollection.deleteOne(query)
            res.send(result);
        })

        // admin
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) =>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        //menu related API
        app.get('/menu', async(req, res) =>{
            const result = await menuCollection.find().toArray()
            res.send(result)
        })

        app.get('/menu/:id', async(req, res) =>{
            const id = req.params.id;
            // const query = {_id: new ObjectId(id)}
            const query = {_id: id}
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        app.post('/menu',verifyToken, verifyAdmin,  async(req, res) =>{
            const item = req.body;
            const result = await menuCollection.insertOne(item);
            console.log(result);
            res.send(result);
        })

        app.patch('/menu/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: id }
            const updatedDoc = {
                $set: {
                name: item.name,
                category: item.category,
                price: item.price,
                recipe: item.recipe,
                image: item.image
                }
            }
            const result = await menuCollection.updateOne(filter, updatedDoc)
            console.log(result);
            res.send(result);
        })

        app.delete('/menu/:id', verifyToken, verifyAdmin, async(req, res) =>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })

        //reviews related API
        app.get('/reviews', async(req, res) =>{
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })

        // carts collection
        app.post('/carts', async(req,res) =>{
            const cartItems = req.body;
            const result = await cartsCollection.insertOne(cartItems);
            res.send(result);
        })

        app.get('/carts', async(req, res) =>{
            const email = req.query.email;
            const query = {email: email}
            const result = await cartsCollection.find(query).toArray()
            res.send(result);
        })

        app.delete('/carts/:id', async(req, res) =>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })

        // payment intent
    app.post('/create-payment-intent', async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        console.log(amount, 'amount inside the intent')

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
        });

        res.send({
            clientSecret: paymentIntent.client_secret
        })
    });

    app.get('/payments/:email', verifyToken, async (req, res) => {
        const query = { email: req.params.email }
        if (req.params.email !== req.decoded.email) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
    })

    app.post('/payments', async(req, res) =>{
        const payment = req.body;
        const paymentResult = await paymentCollection.insertOne(payment);

        //carefully each item delete from the cart;
        console.log('payment info', paymentResult);
        const query = {
            _id: {
                $in: payment.cartIds.map(id => new ObjectId(id))
        }}

        const deleteResult = await cartsCollection.deleteMany(query)

        //send user email about payment confirmation;
        sendEmail(req.body.email, {
            subject: 'Payment Successful!',
            message: `Thank you for taka dewar jonno amake, Your Transaction Id: ${payment.transactionId}`,
        })

        res.send({paymentResult, deleteResult})
    })

    //stats or analytic
    app.get('/admin-stats', verifyToken, verifyAdmin,  async(req, res) =>{
        const users = await usersCollection.estimatedDocumentCount();
        const menuItems = await menuCollection.estimatedDocumentCount();
        const orders = await paymentCollection.estimatedDocumentCount();

        //this is not the best way
        // const payments = await paymentCollection.find().toArray();
        // const revenue = payments.reduce( (total, payment) => total + payment.price ,0)

        const result = await paymentCollection.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: '$price'
                    }
                }
            },
        ]).toArray();

        const revenue = result.length > 0 ? result[0].totalRevenue.toFixed(2) : 0;

        res.send({
            users,
            menuItems,
            orders,
            revenue,
        })
    })

    /**
     * ------------------------------------------
     *          NON-Efficient Way
     * ------------------------------------------
     * 1. load all the payments
     * 2. for every menuitemIds (which is an array), go find the item from menu collection
     * 3. for every item in the menu collection that you found from a payment entry (document)
     */

    //using aggregate pipeline
    app.get('/order-stats', verifyToken, verifyAdmin, async(req, res) =>{
        const result = await paymentCollection.aggregate([
            {
                $unwind: '$menuItemIds'
            },
            {
                $lookup: {
                    from: 'menu',
                    localField: 'menuItemIds',
                    foreignField: '_id',
                    as: 'menuItems'
                }
            },
            {
                $unwind: '$menuItems'
            },
            {
                $group : {
                    _id: '$menuItems.category',
                    quantity: { $sum: 1 },
                    revenue: { $sum : '$menuItems.price'}
                }
            },
            {
                $project: {
                    _id: 0,
                    category: '$_id',
                    quantity: '$quantity',
                    revenue: '$revenue'
                }
            }
        ]).toArray();

        res.send(result)
    })


        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send("BISTRO BOSS RASSTUREENT");
});

app.listen(port, () => {
    console.log(`Bistro boss rasstureent on ${port}`);
});
