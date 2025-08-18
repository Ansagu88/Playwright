import dotenv from 'dotenv';
dotenv.config();

export const userMock = {
    url: process.env.URL ?? "",
    email: process.env.EMAIL ?? "",
    password: process.env.PASSWORD ?? "",
    name: "Usuario de Aplicaciones",
}