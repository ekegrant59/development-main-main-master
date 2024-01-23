const mongoose = require('mongoose')
const mongodb = process.env.MONGODB
mongoose.connect(mongodb)

const balanceSchema = new mongoose.Schema({
    email: String,
    name: String,
    balance: Number,
    deposit: Number,
    withdrawal: Number,
    profit: Number
})

module.exports = mongoose.model('balance', balanceSchema)