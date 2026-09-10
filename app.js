(function () {
  "use strict";

  const employeeIdInput = document.getElementById("employeeId");
  const employeeNote = document.getElementById("employeeNote");
  const employeePinInput = document.getElementById("employeePin");
  const checkTypeInputs = Array.from(document.querySelectorAll('input[name="checkType"]'));
  const locateBtn = document.getElementById("locateBtn");
  const locationNote = document.getElementById("locationNote");
  const submitBtn = document.getElementById("submitBtn");
  const resultBox = document.getElementById("result");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const offlineBanner = document.getElementById("offlineBanner");
  const clockLine = document.getElementById("clockLine");
  const installBtn = document.getElementById("installBtn");

  let state = {
    type: "IN",
    coords: null,
    employeeVerified: false,
  };

  // ---------------------------------------------------
  // Live clock line
  // ---------------------------------------------------
  function tickClock() {
    const now = new Date();
    clockLine.textContent = now.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------------------------------------------------
  // Online / offline status
  // ---------------------------------------------------
  function updateOnlineStatus() {
    const online = navigator.onLine;
    statusDot.classList.toggle("is-online", online);
    statusDot.classList.toggle("is-offline", !online);
    statusText.textContent = online ? "Online" : "Offline";
    offlineBanner.classList.toggle("visible", !online);
    evaluateSubmitEnabled();
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // Wake up the Apps Script backend early so Submit feels faster later
  jsonpRequest({ action: "ping" }).catch(() => {});

  // ---------------------------------------------------
  // JSONP helper (Apps Script Web Apps don't reliably
  // support fetch()/CORS for this project's setup, and
  // the backend already implements a JSONP callback)
  // ---------------------------------------------------
  let jsonpCounter = 0;
  function jsonpRequest(params, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!CONFIG.API_URL || CONFIG.API_URL.indexOf("PASTE_YOUR_WEB_APP_URL_HERE") !== -1) {
        reject(new Error("The app isn't connected to a backend yet. Add your Web App URL in config.js."));
        return;
      }

      jsonpCounter += 1;
      const callbackName = "__attendanceCb" + jsonpCounter;
      const script = document.createElement("script");
      let settled = false;

      const cleanup = () => {
        delete window[callbackName];
        script.remove();
        clearTimeout(timer);
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("The request timed out. Check your connection and try again."));
      }, timeoutMs || 15000);

      window[callbackName] = function (data) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(data);
      };

      script.onerror = function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Couldn't reach the backend. Check the Web App URL and deployment settings."));
      };

      const query = new URLSearchParams({
        api: "attendance",
        callback: callbackName,
        ...params,
      });

      script.src = CONFIG.API_URL + "?" + query.toString();
      document.body.appendChild(script);
    });
  }

  // ---------------------------------------------------
  // Employee ID lookup (on blur, debounced-ish)
  // ---------------------------------------------------
  let lookupToken = 0;
  employeeIdInput.addEventListener("blur", async () => {
    const id = employeeIdInput.value.trim();
    state.employeeVerified = false;
    evaluateSubmitEnabled();

    if (!id) {
      setNote(employeeNote, "", null);
      return;
    }

    const myToken = ++lookupToken;
    setNote(employeeNote, "Checking employee ID…", null);

    try {
      const data = await jsonpRequest({ action: "employee", employeeId: id });
      if (myToken !== lookupToken) return; // stale response

      if (data && data.success) {
        state.employeeVerified = true;
        setNote(employeeNote, `${data.employeeName}${data.department ? " · " + data.department : ""}`, "good");
      } else {
        setNote(employeeNote, (data && data.message) || "Employee ID not found.", "bad");
      }
    } catch (err) {
      if (myToken !== lookupToken) return;
      setNote(employeeNote, err.message, "bad");
    }
    evaluateSubmitEnabled();
  });

  function setNote(el, text, kind) {
    el.textContent = text || "\u00A0";
    el.classList.toggle("is-good", kind === "good");
    el.classList.toggle("is-bad", kind === "bad");
  }

  // ---------------------------------------------------
  // IN / OUT radio buttons
  // ---------------------------------------------------
  checkTypeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.type = input.value;
      }
    });
  });

  // ---------------------------------------------------
  // Geolocation
  // ---------------------------------------------------
  locateBtn.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      locationNote.textContent = "This device doesn't support location.";
      return;
    }

    locateBtn.disabled = true;
    locationNote.textContent = "Locating…";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        locationNote.textContent =
          `Captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} ` +
          `(±${Math.round(pos.coords.accuracy)}m)`;
        locateBtn.disabled = false;
        evaluateSubmitEnabled();
      },
      (err) => {
        state.coords = null;
        locationNote.textContent = "Couldn't get location — " + describeGeoError(err);
        locateBtn.disabled = false;
        evaluateSubmitEnabled();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  function describeGeoError(err) {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return "location permission was denied.";
      case err.POSITION_UNAVAILABLE:
        return "position unavailable.";
      case err.TIMEOUT:
        return "it took too long.";
      default:
        return "unknown error.";
    }
  }

  // ---------------------------------------------------
  // Submit gating
  // ---------------------------------------------------
  function evaluateSubmitEnabled() {
    const ready =
      navigator.onLine &&
      employeeIdInput.value.trim().length > 0 &&
      employeePinInput.value.trim().length > 0 &&
      !!state.coords;
    submitBtn.disabled = !ready;
  }
  employeeIdInput.addEventListener("input", evaluateSubmitEnabled);
  employeePinInput.addEventListener("input", evaluateSubmitEnabled);

  // ---------------------------------------------------
  // Submit
  // ---------------------------------------------------
  submitBtn.addEventListener("click", async () => {
    const id = employeeIdInput.value.trim();
    const pin = employeePinInput.value.trim();
    if (!id || !pin || !state.coords) return;

    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    hideResult();

    try {
      const data = await jsonpRequest({
        action: "submit",
        employeeId: id,
        pin: pin,
        type: state.type,
        latitude: state.coords.latitude,
        longitude: state.coords.longitude,
      });

      if (data && data.success) {
        showResult(true, data);
        employeePinInput.value = ""; // don't leave the PIN sitting in the field
      } else {
        showResult(false, data);
      }
    } catch (err) {
      showResult(false, { message: err.message });
    } finally {
      submitBtn.classList.remove("is-loading");
      evaluateSubmitEnabled();
    }
  });

  function hideResult() {
    resultBox.hidden = true;
    resultBox.innerHTML = "";
  }

  function showResult(success, data) {
    resultBox.hidden = false;
    resultBox.classList.toggle("is-good", success);
    resultBox.classList.toggle("is-bad", !success);

    if (success) {
      resultBox.innerHTML = `
        <p class="result-title">✓ ${escapeHtml(data.message || "Attendance submitted.")}</p>
        <dl>
          <dt>Employee</dt><dd>${escapeHtml(data.employee || "—")}</dd>
          <dt>Department</dt><dd>${escapeHtml(data.department || "—")}</dd>
          <dt>Type</dt><dd>${escapeHtml(state.type)}</dd>
          <dt>Location</dt><dd><a href="${escapeHtml(data.mapsLink || "#")}" target="_blank" rel="noopener">${data.latitude?.toFixed(5)}, ${data.longitude?.toFixed(5)}</a></dd>
        </dl>
      `;
    } else {
      resultBox.innerHTML = `<p class="result-title">✕ Couldn't submit</p><p>${escapeHtml(data && data.message ? data.message : "Something went wrong.")}</p>`;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------------------------------------------------
  // Install prompt (Android/desktop Chrome)
  // ---------------------------------------------------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    installBtn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
  });

  // ---------------------------------------------------
  // Service worker registration
  // ---------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        // Non-fatal — app still works online without the SW.
      });
    });
  }
})();
