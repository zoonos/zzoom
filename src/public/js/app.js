const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const cameraSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const list = document.getElementById('list');

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChnnel;

function addMessage(message){
    const ul = list.querySelector('ul');
    const li = document.createElement('li');
    li.innerText = message;
    ul.appendChild(li);
}

async function getCameras(){
    try{
        const devices = await navigator.mediaDevices.enumerateDevices(); // 미디어 디바이스 찾음
        const cameras = devices.filter((device) => device.kind === "videoinput"); // 종류가 videoinput인걸 찾음
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            // 카메라 리스트를 option으로 만들어서 넣어줌.
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label == camera.label){
                option.selected = true;
            }
            cameraSelect.appendChild(option);
        })
    } catch(e) {
        console.log(e)
    }
}

async function getMedia(deviceId){
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" } // 모바일에서는 전면카메라 PC에서는 내장 기본 카메라를 선택
    }
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId } }
    }
    try{
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initialConstraints
        );
        console.log(myStream);
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }
    } catch(e){
        console.log(e)
    }
}

function handleMuteClick(){
    myStream.getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
    if(!muted){
        muteBtn.innerText = '음소거 해제';
        muted = true;
    } else {
        muteBtn.innerText = '음소거';
        muted = false;
    }
}

function handleCameraClick(){
    myStream.getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
    if(!cameraOff){
        cameraBtn.innerText = '카메라 켜기';
        cameraOff = true;
    } else {
        cameraBtn.innerText = '카메라 끄기';
        cameraOff = false;
    }
}

async function handlerCameraChange(){
    await getMedia(cameraSelect.value);
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders()
                            .find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
cameraSelect.addEventListener("input", handlerCameraChange);

// Welcome Form (join a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

call.hidden = true;

async function initCall(){
    welcome.hidden = true;
    call.hidden = false;
    const roomTitle = call.querySelector('.roomTitle');
    roomTitle.innerText = `방이름 : ${roomName}`
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event){
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    roomName = input.value;
    await initCall();
    socket.emit("join_room", input.value);
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// offer는 같은 서버에 접속해 있는 다른 사용자에게 서버 거치지 말고 p2p로 소통하자고 제안 하는 것

// Socket Code
socket.on("welcome", async () => { // offer를 보내는 쪽에서 실행
    myDataChnnel = myPeerConnection.createDataChannel("chat");
    myDataChnnel.addEventListener("message", (event) => {
        console.log(event.data);
    })
    console.log("made data channel");
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer"); 
    socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => { // offer를 받는쪽에서 실행
    myPeerConnection.addEventListener("datachannel", (event) => {
        myDataChnnel = event.channel;
        myDataChnnel.addEventListener("message", (event) => {
            console.log(event.data);
        });
    })
    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
})

socket.on("answer", answer => { // offer를 보냈던 쪽에서 answer를 받으면서 실행
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer);
})

socket.on("ice", ice => {
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
})

socket.on("bye", ()=>{
    alert("떠났습니다.")
})

// RTC Code
function makeConnection(){
    myPeerConnection = new RTCPeerConnection({
        iceServers:[
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302"
                ]
            }
        ]
});
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks()
    .forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data){
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data){
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}