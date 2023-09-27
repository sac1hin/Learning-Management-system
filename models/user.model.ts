require('dotenv').config();
import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const emailRegexPattern: RegExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

export interface IUSer extends Document {
    name: string;
    email: string;
    password: string;
    avatar: {
        publicId: string
        url: string
    };
    role: string;
    isVerified: boolean;
    courses: Array<{ courseId: string }>;
    comparePassword: (password: string) => Promise<boolean>;
    SignAccessToken: () => string,
    SignRefreshToken: () => string
}

const userSchema: Schema<IUSer> = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter name']
    },
    email: {
        type: String,
        required: [true, "Please enter email"],
        validate: {
            validator: function (value: string) {
                return emailRegexPattern.test(value);
            },
            message: "Please enter a valid email",
        },
        unique: true,
    },
    password: {
        type: String,
        required: [true, "Please enter password"],
        minlength: [6, "Password must be at least 6 characters"],
        select: false
    },
    avatar: {
        publicId: String,
        url: String,
    },
    role: {
        type: String,
        default: "user",
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    courses: [
        {
            courseId: String
        }
    ],
}, {
    timestamps: true
})

//hash passowrd bedore saving
userSchema.pre<IUSer>('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

//sign access token
userSchema.methods.SignAccessToken = function(){
    return jwt.sign({id:this._id},process.env.ACCESS_TOKEN || '');
}

userSchema.methods.SignRefreshToken = function(){
    return jwt.sign({id:this._id},process.env.REFRESH_TOKEN || '');
}

userSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password)
};

const userModel: Model<IUSer> = mongoose.model("User", userSchema);

export default userModel;