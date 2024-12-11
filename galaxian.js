/* GLOBAL CONSTANTS AND VARIABLES */
const WIN_Z = 0;  
const WIN_LEFT = 0; const WIN_RIGHT = 1;  
const WIN_BOTTOM = 0; const WIN_TOP = 1;  

var Eye = new vec4.fromValues(0, -0.5, 4,1.0);  
var Center = new vec3.fromValues(0, 0, 0);
var viewUp = new vec3.fromValues(0, 1, 0);
var lookAt = new vec3.fromValues(0, 0, -1);

var gl = null; 
var triangleBuffer; 
var triBufferSize; 
var vertexPositionAttrib; 
var vertexNormalAttrib;
var alphaULoc;

var vertexBuffers = []; 
var normalBuffers = [];
var triangleBuffers = [];
var trianglesPerSet = [];

var numTriSets = 0;
var inputTriangles = [];
var inputIndex = 0;

var player = [];
var invaders = [];
var bullet = [];
var venom = [];
var descendingAliens = [];
var fixedAliens = [];

var lightPosition = vec3.fromValues(-5,0,0.5);
var lightColor = vec3.fromValues(1.0,1.0,1.0);

var ambientUniform;
var diffuseUniform;
var specularUniform;
var shininessUniform;

var modelMatrixUniform;
var mvpMatrixUniform;

var inAir = false;
var bulletSpeed = 0.1;
var score = 0;

const BG_URL = "galaxy.png";
const DISCO_URL = "disco.png";

var colorChange = false;
var prevSwitchTime = 0;

var state = {
    projectionMatrix: mat4.create(),
    viewMatrix: mat4.create(),
    modelMatrix: mat4.create(),
    pvMatrix: mat4.create(),
    mvpMatrix: mat4.create(),
};


var youLose = false;
/* HELPER FUNCTIONS */
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); 
            httpReq.open("GET",url,false); 
            httpReq.send(null); 
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } 
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        }
    }  
    catch(e) {
        console.log(e);
        return(String.null);
    }
} 

function setupWebGL(url) {
    var imageCanvas = document.getElementById("myImageCanvas"); 
    var cw = imageCanvas.width, ch = imageCanvas.height; 
    imageContext = imageCanvas.getContext("2d"); 
    var bkgdImage = new Image(); 
    bkgdImage.crossOrigin = "Anonymous";
    bkgdImage.src = url;
    bkgdImage.onload = function() {
        var iw = bkgdImage.width, ih = bkgdImage.height;
        imageContext.drawImage(bkgdImage, 0, 0, iw, ih, 0, 0, cw, ch);   
    }
    
    var canvas = document.getElementById("myWebGLCanvas"); 
    gl = canvas.getContext("webgl");
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearDepth(1.0); 
        gl.enable(gl.DEPTH_TEST); 
      }
    } 
    catch(e) {
      console.log(e);
    } 
} 

function loadTriangles(thisURL, desrc) {

    function sortTriangles() {
        inputTriangles.forEach(set => {
            if (set.material.name.includes("player")) {
                player.push(set);
            } else if (set.material.name.includes("alien")) {
                invaders.push(set);
            } else if (set.material.name.includes("bullet")) {
                bullet.push(set);
            } else if (set.material.name.includes("venom")) {
                venom.push(set);
            }
        });
    }

    var invaderPositions = [
        [-0.5, 1.3],
        [0, 1.3],
        [0.5, 1.3],
        [1, 1.3],
        [-0.75, 0.8],
        [-0.25, 0.8],
        [0.25, 0.8],
        [0.75, 0.8],
        [-1, 0.5],
        [-0.5, 0.5],
        [0, 0.5],
        [0.5, 0.5]
    ];

    function assignInvaderPositions() {
        invaders.forEach((invader, index) => {
            invader.descending = false;
            invader.hasDependency = false;
            invader.dependencyCode = null;
            invader.myVenom = [];
            if (invader.material.loc === "R1C1") {
                invader.hasDependency = true;
                invader.dependencyCode = "R3C2";
            } else if (invader.material.loc === "R1C2") {
                invader.hasDependency = true;
                invader.dependencyCode = "R3C3";
            } else if (invader.material.loc === "R1C3") {
                invader.hasDependency = true;
                invader.dependencyCode = "R3C4";
            }
            invader.xPos = invaderPositions[index][0];
            invader.yPos = invaderPositions[index][1];
            invader.myPos = vec3.fromValues(invader.xPos, invader.yPos, invader.translation[2]);
        });
    }

    function assignInvaderVenom() {
        invaders.forEach(invader => {
            fixedAliens.push(invader);
            var invaderCode = invader.material.loc;
            venom.forEach(bullet => {
                if (bullet.material.parent === invaderCode) {
                    bullet.shooting = false;
                    bullet.xPos = invader.xPos;
                    bullet.yPos = invader.yPos;
                    invader.myVenom.push(bullet);
                }
            });
        })
    }
    function setPlayerPos() {
        player.forEach(triangle => {
            triangle.xPos = 0;
            triangle.yPos = -1;
        });
    }

    inputTriangles = getJSONFile(thisURL, desrc);
    if (inputTriangles != String.null) { 
        var whichSetVert;
        var whichSetTri; 
        var vertex;
        var normal;
        var triangle;
        var vertexMax = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); 
        var vertexMin = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); 
        
        numTriSets = inputTriangles.length;
        for (var whichSet = 0; whichSet < numTriSets; whichSet++) {
            inputTriangles[whichSet].center = vec3.fromValues(0,0,0);
            inputTriangles[whichSet].x = vec3.fromValues(1,0,0); 
            inputTriangles[whichSet].y = vec3.fromValues(0,1,0);
            inputTriangles[whichSet].highlighted = false;
            inputTriangles[whichSet].translation = vec3.fromValues(0,0,0);
            inputTriangles[whichSet].rotation = mat4.create();
            
            inputTriangles[whichSet].myVertices = [];
            inputTriangles[whichSet].myNormals = [];
            var numVertices = inputTriangles[whichSet].vertices.length;
            for (whichSetVert = 0; whichSetVert < numVertices; whichSetVert++){
                vertex = inputTriangles[whichSet].vertices[whichSetVert];
                normal = inputTriangles[whichSet].normals[whichSetVert];
                inputTriangles[whichSet].myVertices.push(vertex[0], vertex[1], vertex[2]);
                inputTriangles[whichSet].myNormals.push(normal[0], normal[1], normal[2]);
               
                vec3.max(vertexMax, vertexMax, vertex); 
                vec3.min(vertexMin, vertexMin, vertex); 
                vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vertex);
            }
            vec3.scale(inputTriangles[whichSet].center, inputTriangles[whichSet].center, 1 / numVertices);
            
            vertexBuffers[whichSet] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].myVertices), gl.STATIC_DRAW);

            normalBuffers[whichSet] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].myNormals), gl.STATIC_DRAW);

            inputTriangles[whichSet].myTriangles = [];
            trianglesPerSet[whichSet] = inputTriangles[whichSet].triangles.length;
            for (var whichSetTri = 0; whichSetTri < trianglesPerSet[whichSet]; whichSetTri++) {
                triangle = inputTriangles[whichSet].triangles[whichSetTri];
                inputTriangles[whichSet].myTriangles.push(triangle[0], triangle[1], triangle[2]);
            }
            
            triangleBuffers.push(gl.createBuffer())
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputTriangles[whichSet].myTriangles), gl.STATIC_DRAW);
        } 
    } 
    sortTriangles();
    assignInvaderPositions();
    assignInvaderVenom();
    setPlayerPos();
} 

function setupShaders() {
    
    var fShaderCode = `
        precision mediump float;

        varying vec3 fragNormal;
        varying vec3 fragPosition;

        uniform vec3 lightPosition;
        uniform vec3 viewPosition;
        uniform vec3 lightColor;

        uniform vec3 ambientColor;
        uniform vec3 diffuseColor;
        uniform vec3 specularColor;
        uniform float shininess;
        uniform float uAlpha;

        void main(void) {
            vec3 ambient = ambientColor * lightColor;

            vec3 normal = normalize(fragNormal);
            vec3 lightDir = normalize(lightPosition - fragPosition);
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diffuseColor * lightColor * diff;

            vec3 viewDir = normalize(viewPosition - fragPosition);
            vec3 reflectDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(normal, reflectDir), 0.0), shininess);
            vec3 specular = specularColor * lightColor * spec;

            vec3 finalColor = ambient + diffuse + specular;
            gl_FragColor = vec4(finalColor, uAlpha); // final color
        }
    `;
    
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        varying vec3 fragNormal;
        varying vec3 fragPosition;
  
        uniform mat4 modelMatrix;
        uniform mat4 mvpMatrix;

        void main(void) {

            vec4 fragPos4 = modelMatrix * vec4(vertexPosition, 1.0);
            fragPosition = vec3(fragPos4.x, fragPos4.y, fragPos4.z);
            gl_Position = mvpMatrix * vec4(vertexPosition, 1.0);

            vec4 fragNormal4 = modelMatrix * vec4(vertexNormal, 0.0);
            fragNormal = normalize(vec3(fragNormal4.x, fragNormal4.y, fragNormal4.z));
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); 
        gl.shaderSource(fShader,fShaderCode); 
        gl.compileShader(fShader); 

       
        var vShader = gl.createShader(gl.VERTEX_SHADER); 
        gl.shaderSource(vShader,vShaderCode); 
        gl.compileShader(vShader); 

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { 
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { 
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { 
            var shaderProgram = gl.createProgram(); 
            gl.attachShader(shaderProgram, fShader); 
            gl.attachShader(shaderProgram, vShader);
            gl.linkProgram(shaderProgram); 

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { 
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { 
                gl.useProgram(shaderProgram); 

                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); 

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);

                var viewPositionUniform = gl.getUniformLocation(shaderProgram, "viewPosition");
                var lightColorUniform = gl.getUniformLocation(shaderProgram, "lightColor");
                var lightPositionUniform = gl.getUniformLocation(shaderProgram, "lightPosition");

                gl.uniform3fv(lightPositionUniform, lightPosition);
                gl.uniform3fv(viewPositionUniform, [Eye[0], Eye[1], Eye[2]]);
                gl.uniform3fv(lightColorUniform, lightColor);

                ambientUniform = gl.getUniformLocation(shaderProgram, "ambientColor");
                diffuseUniform = gl.getUniformLocation(shaderProgram, "diffuseColor");
                specularUniform = gl.getUniformLocation(shaderProgram, "specularColor");
                shininessUniform = gl.getUniformLocation(shaderProgram, "shininess");
                alphaULoc = gl.getUniformLocation(shaderProgram, "uAlpha");

                modelMatrixUniform = gl.getUniformLocation(shaderProgram, "modelMatrix");
                mvpMatrixUniform = gl.getUniformLocation(shaderProgram, "mvpMatrix");
            } 
        } 
    } 
    catch(e) {
        console.log(e);
    } 
    altPosition = false;
    setTimeout(function alterPosition() {
        altPosition = !altPosition;
        setTimeout(alterPosition, 2000);
    }, 2000);
} 

function getRotationMatrix(x, y, z) {
    return mat4.fromValues(
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        0, 0, 0, 1
    );
}

function getModel(thisModel, modelMatrix) {
    var z = vec3.create();
    var rotationMatrix = mat4.create();
    var tempMatrix = mat4.create();
    var negCenter = vec3.create();

    mat4.fromTranslation(modelMatrix, vec3.negate(negCenter, thisModel.center));
    
    vec3.normalize(z, vec3.cross(z, thisModel.x, thisModel.y));
    rotationMatrix = getRotationMatrix(thisModel.x, thisModel.y, z);
    mat4.multiply(modelMatrix, rotationMatrix, modelMatrix);
    
    mat4.multiply(modelMatrix, mat4.fromTranslation(tempMatrix, thisModel.center), modelMatrix);
    mat4.multiply(modelMatrix, mat4.fromTranslation(tempMatrix, thisModel.translation), modelMatrix);
}

function renderGroup(triangleGroup, modelMatrix, pvMatrix, mvpMatrix) {
    var currentTime = Date.now();
    if (currentTime - prevSwitchTime > 500) {
        colorChange = !colorChange;
        prevSwitchTime = currentTime;
    }
    triangleGroup.forEach(thisModel => {
        var thisColor;
        if (thisModel.material.name === "alien") {
            thisColor = colorChange ? [0.11, 0.28, 1] : thisModel.material.diffuse;
        } else {
            thisColor = thisModel.material.diffuse;
        }
        getModel(thisModel, modelMatrix);
        mat4.multiply(mvpMatrix, pvMatrix, modelMatrix);

        gl.uniformMatrix4fv(modelMatrixUniform, false, modelMatrix);
        gl.uniformMatrix4fv(mvpMatrixUniform, false, mvpMatrix);

        gl.uniform3fv(ambientUniform, thisModel.material.ambient);
        gl.uniform3fv(diffuseUniform, thisColor);
        gl.uniform3fv(specularUniform, thisModel.material.specular);
        gl.uniform1f(shininessUniform, thisModel.material.n);
        var clampedAlpha = Math.max(0.0, Math.min(1.0, thisModel.material.alpha));
        gl.uniform1f(alphaULoc, clampedAlpha); 
        if (clampedAlpha === 1) {
            gl.depthMask(true);
        } else {
            gl.depthMask(false);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[inputTriangles.indexOf(thisModel)]);
        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[inputTriangles.indexOf(thisModel)]);
        gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[inputTriangles.indexOf(thisModel)]);
        gl.drawElements(gl.TRIANGLES, 3 * trianglesPerSet[inputTriangles.indexOf(thisModel)], gl.UNSIGNED_SHORT, 0); // new rendering

    });
}

var playerSpeed = 0;
function renderTriangles() {

    // var projectionMatrix = mat4.create();
    // var viewMatrix = mat4.create();
    // var modelMatrix = mat4.create();
    // var pvMatrix = mat4.create();
    // var mvpMatrix = mat4.create();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    mat4.perspective(state.projectionMatrix, Math.PI / 4, 1, 0.1, 10);
    mat4.lookAt(state.viewMatrix, [Eye[0], Eye[1], Eye[2]], Center, viewUp);
    mat4.multiply(state.pvMatrix, state.projectionMatrix, state.viewMatrix);

    renderGroup(player, state.modelMatrix, state.pvMatrix, state.mvpMatrix);
    renderGroup(bullet, state.modelMatrix, state.pvMatrix, state.mvpMatrix);
    renderGroup(invaders, state.modelMatrix, state.pvMatrix, state.mvpMatrix);
    // renderGroup(venom, state.modelMatrix, state.pvMatrix, state.pvMatrix);

    alienMarch();
    movePlayer(playerSpeed);

    requestAnimationFrame(renderTriangles);
    
    gl.depthMask(true);
} 

var isCollision = false;
var leftMost = null;
var rightMost = null;
var invaderIdx;
function updateGame() {
    checkYouWin();
    checkBoundary();
    bullet.forEach(triangle => {
        collision(triangle);
        var outOfBounds = triangle.translation[1] > 2;
        if (inAir) {
            vec3.add(triangle.translation, triangle.translation, [0, bulletSpeed, 0]);
            if (outOfBounds || isCollision) {
                if (outOfBounds) {
                    reset();
                } else {
                    killInvader(invaderIdx);
                    score++
                    updateScore();
                    reset();
                }
            }
        } else {
            reset();
        }
    });
    requestAnimationFrame(updateGame);
}

function checkYouWin() {
    if (!youLose) {
        if (fixedAliens.length === 0 && descendingAliens.length === 0 || invaders.length === 0) {
            youWin();
            return;
        }
    }
}

function killInvader(index) {
    var invader = invaders[index];
    if (invader) {
        invader.myVenom.forEach((venom, index) => {
            if (!venom.shooting) {
                invader.myVenom.splice(index);
            }
        });
        if (fixedAliens.includes(invader)) {
            var fixedIdx = fixedAliens.indexOf(invader);
            fixedAliens.splice(fixedIdx, 1);
        } else if (descendingAliens.includes(invader)) {
            var descendingIdx = descendingAliens.indexOf(invader);
            descendingAliens.splice(descendingIdx, 1);
        }
        invaders.splice(index, 1);
        invaderCodes.splice(index, 1);
    }
    return;
}

var lowestRow = null;
var lowestRowPos = 1.3;
var yPositions = [0.5, 0.8, 1.3];
function checkBoundary() {
    var smallestY = 1.3;
    var smallestX = Number.MAX_VALUE;
    var largestX = Number.MIN_VALUE;
    if (fixedAliens.length === 1) {
        smallestY = fixedAliens[0].yPos;
        leftMost = fixedAliens[0];
        rightMost = fixedAliens[0];
    } else {
        fixedAliens.forEach(invader => {
            if (invader.yPos < smallestY) {
                smallestY = invader.yPos;
            }
            if (invader.xPos < smallestX) {
                smallestX = invader.xPos;
                leftMost = invader;
            } 
            if (invader.xPos > largestX) {
                largestX = invader.xPos;
                rightMost = invader;
            }
        });
        if (smallestY === 0.5) {
            lowestRow = "bottom";
        } else if (smallestY === 0.8) {
            lowestRow = "middle";
        } else if (smallestY === 1.3) {
            lowestRow = "top";
        }
        lowestRowPos = smallestY;
    }
}

var alienSpeed = 0.02;
var alienDir = -1;
var leftEdge = -1.4;
var rightEdge = 1.4;
var bounce;
// March of the aliens
function alienMarch() {
    if (fixedAliens.length === 0 || invaders.length === 0) {
        setTimeout(() => {
            return;
        }, 2000);
    }
    if (leftMost != null && rightMost != null) {
        invaders.forEach(triangle => {
            if (!triangle.descending) {
                vec3.add(triangle.translation, triangle.translation, [alienDir * alienSpeed, 0, 0]);
                vec3.add(triangle.myPos, triangle.myPos, [alienDir * alienSpeed, 0, 0])
                triangle.myVenom.forEach(venom => {
                    vec3.add(venom.translation, venom.translation, [alienDir * alienSpeed, 0, 0]);
                    venom.xPos += alienDir * alienSpeed;
                })
                if ((triangle === leftMost && triangle.myPos[0] < leftEdge) || (triangle === rightMost && triangle.myPos[0] > rightEdge)) {
                    bounce = true;
                }
            }
        });
        if (bounce) {
            alienDir *= -1;
            bounce = false;
        }
    }
}

function sinusoidCap() {
    if (fixedAliens.length >= 2) {
        if (fixedAliens === 2) {
            if (bounce) {
                setTimeout(() => {
                    sinusoid();
                }, 1000);
            }
        } else {
            sinusoid();
        }
    } else if (fixedAliens.length > 0) {
        startDescent(fixedAliens[0]);
    } 
}


var conditionalList = [["R1C1", "R3C2"], ["R1C2", "R3C3"], ["R1C3", "R3C4"]];
function sinusoid() {
    // Find valid invader to descend
    function getInvaderIdx() {
        var idx = -1;
        var found = false;
        while (fixedAliens.length > 0 && !found && !youLose) {
            var retIdx = Math.floor(Math.random() * fixedAliens.length);
            var invader = fixedAliens[retIdx];
            if (!fixedAliens.includes(invader)) {
                continue;
            }
            if (conditionalList[0].includes(fixedAliens[retIdx].material.loc)) {
                var depenentInvader = fixedAliens.find(invader => invader.material.loc === conditionalList[1]);
                if (depenentInvader && !descendingAliens.includes(depenentInvader)) {
                    continue;
                }
            }
            idx = retIdx;
            found = true;
        }
        return idx;
    }
    if (!youLose) {
        var idx1 = getInvaderIdx();
        if (idx1 != -1) {
            var invader1 = fixedAliens[idx1];
            startDescent(invader1, idx1);
        }
        var idx2 = getInvaderIdx();
        if (idx2 != -1) {
            setTimeout(() => {
                var invader2 = fixedAliens[idx2];
                startDescent(invader2, idx2);
            }, 2000);
        }
    }
}

function startDescent(invader, idx) {
    invader.descending = true;
    invader.time = 0;
    // invader.material.loc === "R1C4" || invader.material.loc === "R3C1"
    if (invader === leftMost || invader === rightMost) {
        invader.amplitude = Math.random() * 0.015 + 0.01;
    } else {
        invader.amplitude = Math.random() * 0.07 + 0.02;
    }
    fixedAliens.splice(idx, 1);
    descendingAliens.push(invader);
    descend(invader);
}

// Descend sequence for invaders
function descend(invader) {
    var ySpeed = 0.0045;
    var frequency = 0.15;
    function loop() {
        invader.translation[0] += invader.amplitude * Math.sin(invader.time);
        invader.myPos[0] += invader.amplitude * Math.sin(invader.time);
        invader.translation[1] -= ySpeed;
        invader.myPos[1] -= ySpeed;
        invader.myVenom.forEach(venom => {
            if (!venom.shooting) {
                venom.translation[0] += invader.amplitude * Math.sin(invader.time);
                venom.xPos += invader.amplitude * Math.sin(invader.time);
                venom.translation[1] -= ySpeed;
            }
        })
        if (invader.myPos[1] <= lowestRowPos) {
            renderGroup(invader.myVenom, state.modelMatrix, state.pvMatrix, state.mvpMatrix);
            shootVenom(invader.myVenom);
        }
        if (invader.myPos[1] < -1.3) {
            var idx = invaders.indexOf(invader);
            killInvader(idx);
            if (fixedAliens.length === 0 && descendingAliens.length === 0) {
                return;
            }
        } else {
            bullet.forEach(triangle => {
                if (invader.myPos[1] <= -0.5 && Math.abs(invader.myPos[0] - triangle.translation[0]) <= 0.3) {
                    sinGameOver(invader);
                    return;
                }
            });
        }
        invader.time += frequency;
        requestAnimationFrame(loop);
    }
    loop();
}

// Shoot venom for each invader
function shootVenom(venomList) { 
    var venomSpeed = 0.02;
    var offset = 0;
    venomList.forEach((venomBullet, index) => {
        if (index === 0) {
            offset = 0;
        } else if (index === 1) {
            offset = 0.1;
        } else if (index === 2) {
            offset = 0.2;
        }
        if (lowestRow === "top") {
            venom.yPos = 1.3 + offset;
        } else if (lowestRow === "middle") {
            venom.yPos = 0.8 + offset;
        } else if (lowestRow === "bottom") {
            venom.yPos = 0.5 + offset;
        }
        setTimeout(() => {
            venomBullet.shooting = true;
            if (venomBullet.yPos <= - 1.5) {
                venomList.splice(index, 1);
            } else {
                player.forEach(triangle => {
                    console.log(venomBullet.yPos);
                    if (venomBullet.yPos <= -0.2 && Math.abs(venomBullet.xPos - triangle.xPos) <= 0.15) {
                        gameOverVenom(venomList, index);
                        return;
                    }
                });
            }
            venomBullet.translation[1] -= venomSpeed;
            venomBullet.yPos -= venomSpeed;
        }, 1000 * index);
    });
}

// Game over if player was shot by venom
function gameOverVenom(thisVenomList, index) {
    bullet.splice(0, bullet.length);
    player.splice(0, player.length);
    thisVenomList.splice(index, 1);
    youLose = true;
    showYouLose();
    return;
}

// Game over if player collided with alien
function sinGameOver(culprit) {
    bullet.splice(0, bullet.length);
    player.splice(0, player.length);
    var killIndex = invaders.indexOf(culprit);
    var killIndex = -1;
    killInvader(killIndex);
    youLose = true;
    showYouLose();
    return;
}

// You Win sequence
function youWin() {
    showYouWin();
}

// Get top of player
function getPlayerPeak() {
    var topY = -Infinity;
    player.forEach(triangle => {
        triangle.vertices.forEach(vertex => {
            var maxY = vertex[1] + triangle.translation[1];
            topY = Math.max(topY, maxY);
        });
    });
    return topY;
}

// Reset bullet position
function reset() {
    var topY = getPlayerPeak();
    bullet.forEach(triangle => {
        triangle.translation[0] = player[0].translation[0]
        triangle.translation[1] = topY + 0.5;
        triangle.translation[2] = player[0].translation[2];
    });
    inAir = false;    
    isCollision = false;
    bulletSpeed = 0;
    invaderIdx = -1;
}

var invaderCodes = ["R1C1", "R1C2", "R1C3", "R1C4", "R2C1", "R2C2", "R2C3", "R2C4", "R3C1", "R3C2", "R3C3", "R3C4"];
var invaderIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Check for bullet/invader collisions
function collision(triangle) {
    invaders.forEach((invader, index) => {
        var invaderX = parseFloat(Number(invader.myPos[0]).toFixed(1));
        var invaderY = parseFloat(Number(invader.myPos[1]).toFixed(1));
        var bulletX = parseFloat(Number(triangle.translation[0]).toFixed(1));
        var bulletY = parseFloat(Number(triangle.translation[1]).toFixed(1));
        if (bulletY === invaderY) {
            var lowRange = invaderX - 0.1;
            var highRange = invaderX + 0.1;
            if (bulletX >= lowRange && bulletX <= highRange) {
                invaderIdx = index;
                isCollision = true;
                return;
            }
        }
    });
}

// Move player across screen with boundaries
function movePlayer(dx) {
    player.forEach(triangle => {
        var newX = triangle.translation[0] + dx;
        if (newX > -1.4 && newX < 1.4) {
            vec3.add(triangle.translation, triangle.translation, [dx, 0, 0]);
            triangle.xPos += dx;
        }
    });
} 

function modelInteraction(event) {
    function shootBullet() {
        if (!inAir) {
            inAir = true;
            bulletSpeed = 0.1;
        }
    }
    switch (event.key) {
        case 'ArrowLeft':
            playerSpeed = -0.05;
            break;
        case 'ArrowRight':
            playerSpeed = 0.05;
            break;
        case ' ':
            shootBullet();
            break;
        case 't':
            break;
        case '!':
            setupWebGL(DISCO_URL);
            boogieFever();
            break;
        default:
            break;
    }
}
document.addEventListener('keydown', modelInteraction);
document.addEventListener('keyup', (event) => {
    playerSpeed = 0;
});

/* MAIN */
function main() {
  setupWebGL(BG_URL); 
  loadTriangles('characters.json', "character triangles"); 
  setupShaders(); 
  renderTriangles(); 
  updateGame();
  setInterval(sinusoidCap, 7000);
} 
