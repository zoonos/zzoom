import http from "http";
import SocketIO from 'socket.io';
import express from 'express';

const app = express();

app.set("view engine", "pug"); // 뷰 엔진 Pug 사용
app.set("views", __dirname + "/views"); // 뷰 경로 지정
app.use("/public", express.static(__dirname + "/public")); // public 정적 파일 기본 경로 지정
app.get("/", (req, res) => res.render("home")); 
app.get("/*", (req, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

wsServer.on("connection", (socket) => {
    // join_room 이벤트 발생 시
    socket.on("join_room", (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit("welcome");
    })
    // offer 이벤트 발생 시
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    })
    // answer 이벤트 발생 시
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer);
    })
    // ice 이벤트 발생 시
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice", ice);
    })
    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => socket.to(room).emit("byle"))
    })
})

const handleListen = () => console.log("Listening on http://localhost:3000");
httpServer.listen(3000, handleListen)