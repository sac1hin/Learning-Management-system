require('dotenv').config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUSer } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import jwt, { Secret } from 'jsonwebtoken';
import path from "path";
import ejs from 'ejs'
import sendMail from "../utils/sendMail";
import { sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";

interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;
}

export const registration = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body;
        const isEmailExists = await userModel.findOne({ email });
        if (isEmailExists) {
            return next(new ErrorHandler("Email already exists", 400));
        }
        const user: IRegistrationBody = {
            name,
            email,
            password
        }

        const activationToken = createActivationToken(user);
        const activationCode = activationToken.activationCode;

        const data = { user: { name: user.name }, activationCode };

        const html = await ejs.renderFile(path.join(__dirname, "../mails/activation.ejs"), data);

        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                template: "activation.ejs",
                data
            })
            const token = createActivationToken(user);
            res.status(201).json({
                success: true,
                message: `Please check your email: ${user.email} to activate your account`,
                acctivationToken: token.token
            })
        } catch (e: any) {
            return next(new ErrorHandler(e.message, 400));
        }
    } catch (e: any) {
        return next(new ErrorHandler(e.message, 400));
    }
});

interface IActivationToken {
    token: string;
    activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(100 * Math.random() * 9000).toString();
    const token = jwt.sign({ user, activationCode }, process.env.ACTIVATION_SECRET as Secret, { expiresIn: "5m" })

    return { token, activationCode };
}

// activate user
interface IActivationRequest {
    activationToken: string,
    activationCode: string
}

export const activateUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activationToken, activationCode } = req.body as IActivationRequest
        const newUser: { user: IUSer; activationCode: string } = jwt.verify(
            activationToken,
            process.env.ACTIVATION_SECRET as string
        ) as { user: IUSer; activationCode: string }

        console.log(newUser);

        if (newUser.activationCode != activationCode) {
            return next(new ErrorHandler('Invalid activation code', 400))
        }
        const { name, email, password } = newUser.user;
        const existUser = await userModel.findOne({ email });

        if (existUser) {
            return next(new ErrorHandler('Email already exist', 400))
        }

        const user = await userModel.create({
            name,
            email,
            password
        })

        res.status(201).json({
            success: true
        })

    } catch (e: any) {
        return next(new ErrorHandler(e.message, 400))
    }
})

//login user
interface ILoginRequest {
    email: string,
    password: string
}

export const loginUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as ILoginRequest
        if (!email || !password) {
            return next(new ErrorHandler('Plase enter email and password', 400))
        }
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            return next(new ErrorHandler("Invalid email and password", 400))
        }

        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return next(new ErrorHandler("Invalid email and password", 400))
        }

        sendToken(user, 200, res);
    } catch (e: any) {
        return next(new ErrorHandler(e.message, 400))
    }
})

export const logoutUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.cookie("accessToken", "", {maxAge:1});
        res.cookie("refreshToken", "", {maxAge:1});
        const userId = req.user?._id || '';
        redis.del(userId)
        res.status(200).json({
            message:"Logged out successfully"
        })
    } catch (e: any) {
        return next(new ErrorHandler(e.message, 400))
    }
})
