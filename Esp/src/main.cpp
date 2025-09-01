
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>

// ===== WiFi Credentials =====
const char* ssid = "Xiaomi";
const char* password = "Hitha@13";

// ===== Fingerprint Sensor =====
HardwareSerial mySerial(2); // UART2 on ESP32
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// ===== Web Server =====
WebServer server(80);

// ===== Helper: Send JSON with CORS =====
void sendJsonResponse(int code, String json) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(code, "application/json", json);
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(200);
}

// ===== Voter Mapping =====
struct Voter {
  int fingerprintId;
  String voterId;
  String name;
  String age;
  String gender;
  String address;

};
Voter voters[100];
int voterCount = 0;

// ===== Enroll Fingerprint =====
uint8_t enrollFingerprint(int id) {
  int p = -1;
  Serial.println("Place finger...");
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) return p;

  Serial.println("Remove finger");
  delay(2000);
  while (finger.getImage() != FINGERPRINT_NOFINGER) {}

  Serial.println("Place same finger again...");
  while (finger.getImage() != FINGERPRINT_OK) {}

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) return p;

  if (finger.createModel() != FINGERPRINT_OK) return p;
  if (finger.storeModel(id) != FINGERPRINT_OK) return p;

  return FINGERPRINT_OK;
}



// ===== Duplicate Check =====
bool isDuplicate() {
    int scannedId = finger.fingerSearch();
    Serial.print("Finger search result: "); Serial.println(scannedId);

    // Compare only with actual enrolled IDs
    for (int i = 0; i < voterCount; i++) {
        if (scannedId == voters[i].fingerprintId) {
            Serial.println("Duplicate fingerprint detected!");
            return true;
        }
    }
    return false; // not found in enrolled IDs
}


// ===== Handle Enroll =====
void handleEnroll() {
  if (!server.hasArg("voter_id") || !server.hasArg("name") || 
      !server.hasArg("age") || !server.hasArg("gender") || 
      !server.hasArg("address")) {
    sendJsonResponse(400, "{\"error\":\"Missing voter details\"}");
    return;
  }
  String voterId = server.arg("voter_id");
    String name = server.arg("name");
  String age = server.arg("age");
  String gender = server.arg("gender");
  String address = server.arg("address");

  Serial.print("Received voter_id: ");
  Serial.println(voterId);
  Serial.print("Name: "); Serial.println(name);
  Serial.print("Age: "); Serial.println(age);
  Serial.print("Gender: "); Serial.println(gender);
  Serial.print("Address: "); Serial.println(address);

  int newId = voterCount + 1;

  // Step 1: Enroll fingerprint (scan, create model, store temporarily)
  uint8_t result = enrollFingerprint(newId);
  if (result != FINGERPRINT_OK) {
    sendJsonResponse(500, "{\"error\":\"Enrollment failed\"}");
    return;
  }

  // Step 2: Check for duplicates among previously enrolled fingerprints
  for (int i = 0; i < voterCount; i++) {
      if (finger.fingerID == voters[i].fingerprintId) {
          sendJsonResponse(400, "{\"error\":\"Duplicate fingerprint\"}");
          return;
      }
  }

  // Step 3: Store voter info
  voters[voterCount].fingerprintId = newId;
  voters[voterCount].voterId = voterId;
  voters[voterCount].name = name;
  voters[voterCount].age = age;
  voters[voterCount].gender = gender;
  voters[voterCount].address = address;

  voterCount++;

  StaticJsonDocument<200> doc;
  doc["status"] = "Enrolled successfully";
  doc["fingerprintId"] = newId;
    // doc["voterId"] = voterId;
  doc["name"] = name;
  doc["age"] = age;
  doc["gender"] = gender;
  doc["address"] = address;

  String json;
  serializeJson(doc, json);
  sendJsonResponse(200, json);
}

// ===== Match Fingerprint =====
int matchFingerprint() {
  int p = finger.getImage();
  Serial.print("getImage result: "); Serial.println(p);
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  Serial.print("image2Tz result: "); Serial.println(p);
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerSearch();
  Serial.print("fingerSearch result: "); Serial.println(p);
  if (p != FINGERPRINT_OK) return -1;

  Serial.print("Matched Finger ID: "); Serial.println(finger.fingerID);
  return finger.fingerID;
}


void handleMatch() {
  int id = matchFingerprint();
  StaticJsonDocument<200> doc;

  if (id == -1) {
    doc["error"] = "Fingerprint not recognized";
  } else {
      bool found = false;
    for (int i = 0; i < voterCount; i++) {
      if (voters[i].fingerprintId == id) {
        doc["status"] = "match";
        doc["fingerprintId"] = id;
        doc["voterId"] = voters[i].voterId;
        doc["name"] = voters[i].name;
        doc["age"] = voters[i].age;
        doc["gender"] = voters[i].gender;
        doc["address"] = voters[i].address;
        found = true;
        break;
      }
    }
    if (!found) {
      doc["error"] = "Voter not found in records";
    }
  }

  String json;
  serializeJson(doc, json);
  sendJsonResponse(200, json); // Always 200
}


// ===== Confirm Vote =====
void handleConfirm() {
  if (!server.hasArg("voter_id")) {
    sendJsonResponse(400, "{\"error\":\"voter_id missing\"}");
    return;
  }
  String voterId = server.arg("voter_id");  // ✅ get from request
  String name = "";
  bool found = false;

  for (int i = 0; i < voterCount; i++) {
    if (voters[i].voterId == voterId) {
      name = voters[i].name;  // ✅ Fetch name
      found = true;
      break;
    }
  }

  StaticJsonDocument<200> doc;
  if (found) {
    Serial.println("Vote cast for Voter ID: " + voterId + " (Name: " + name + ")");
     Serial.println("Thank you for voting" " (Name: " + name + ")");

    doc["status"] = "Vote cast successfully";
    doc["voterId"] = voterId;
    doc["name"] = name;   // ✅ Added to response
  } else {
    doc["error"] = "Voter not found";
  }

  String json;
  serializeJson(doc, json);
  sendJsonResponse(200, json);

}
void handleReset() {
  if (finger.emptyDatabase() != FINGERPRINT_OK) {
    sendJsonResponse(500, "{\"error\":\"Failed to reset fingerprint library\"}");
    return;
  }
  voterCount = 0;
  sendJsonResponse(200, "{\"status\":\"All fingerprints and voter data deleted\"}");
}



// ===== Setup =====
void setup() {
  Serial.begin(115200);
  mySerial.begin(57600, SERIAL_8N1, 16, 17); // RX=16, TX=17

  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor ready.");
  } else {
    Serial.println("Fingerprint sensor NOT found.");
    while (1) delay(1);
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // Routes
  server.on("/enroll", HTTP_GET, handleEnroll);

  server.on("/enroll", HTTP_OPTIONS, handleOptions);

  server.on("/match", HTTP_GET, handleMatch);
  server.on("/match", HTTP_OPTIONS, handleOptions);

  server.on("/confirm", HTTP_POST, handleConfirm);
  server.on("/confirm", HTTP_OPTIONS, handleOptions);

  server.on("/reset", HTTP_POST, handleReset);
  server.on("/reset", HTTP_OPTIONS, handleOptions);


  server.begin();
}

// ===== Loop =====
void loop() {
  server.handleClient();
}
