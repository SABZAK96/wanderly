let myEvents = [];
let firstEventInTrip = undefined;

const tripId = localStorage.getItem("selectedTripId");
// get all the events from the db
async function eventsFromDB(tripId) {
  const calendarError = document.getElementById("calendarError");
  calendarError.classList.add("hidden");
  // reset so re-running this (e.g. after an edit/delete) doesn't pile duplicate entries onto the old ones
  myEvents = [];
  try {
    const response = await fetch(`/allUserActivities/${tripId}`);
    if (response.ok) {
      const data = await response.json();

      if (data.length === 0) {
        calendarError.className =
          "text-md text-base-content/60 mt-1 text-center mb-2";
        calendarError.textContent =
          "No activities to show on your Calendar Yet.";
        calendarError.classList.remove("hidden");
        return;
      }

      // finding the first upcoming event , so the calendar jumps up there
      // allEventDates is an array of strings like ["2026-08-11", "2025-12-25"] which we can use the sort method on
      const allEventDates = data.map((event) => event.date.slice(0, 10));

      // new Date() -> gives current Time, toISOString() -> converts it to a string like 2026-07-29T22:38:15.123Z
      const todayStr = new Date().toISOString().slice(0, 10);
      // the earliest activity for that trip might be a past event, we want to show the first one after todays date
      const upcomingEventDates = allEventDates.filter((d) => d >= todayStr);
      const sortedEventDates = upcomingEventDates.sort();
      firstEventInTrip = sortedEventDates[0];

      data.forEach((obj) => {
        // date that comes from the db is a string in ISO format, and Z should be removed
        // the time that comes from the db is in 14:30 format which should be converted to 14:30:00
        // fullCalendar accepts start: "2026-06-26T09:00:00" which is a string
        const EventStart = obj.date.slice(0, 10) + "T" + obj.startTime + ":00";
        const EventEnd = obj.date.slice(0, 10) + "T" + obj.endTime + ":00";
        myEvents.push({
          id: obj._id, // id is fullCalendar reserved property and won't get rendered on UI
          title: obj.activityName,
          start: EventStart,
          end: EventEnd,
          display: "block",
          editable: true,
          placeId: obj.placeId,
          lat: obj.location?.lat,
          lng: obj.location?.lng,
          solo: obj.participants.length === 1,
        });
      });
    } else {
      calendarError.className = "text-sm text-red-500 mt-1 text-center mb-2";
      calendarError.textContent = await response.text();
      calendarError.classList.remove("hidden");
    }
  } catch (error) {
    calendarError.className = "text-sm text-red-500 mt-1 text-center mb-2";
    calendarError.textContent = "Could not reach the server. Try again.";
    calendarError.classList.remove("hidden");
  }
}

const eventActionModal = document.getElementById("eventActionsModal");
const title = document.getElementById("eventActionsTitle");
const date = document.getElementById("eventEditDate");
const startTime = document.getElementById("eventEditStartTime");
const endTime = document.getElementById("eventEditEndTime");
const eventDeleteScope = document.getElementById("eventDeleteScope");

// resets the event-actions modal's toggle, scope choice, and error messages so stale state from a previous event doesn't leak into the next one
function cleanUpEventActionsModal() {
  document.getElementById("eventAction-edit").checked = true;
  document.getElementById("eventDeleteForGroup").checked = true;
  document.getElementById("eventEditError").classList.add("hidden");
  document.getElementById("eventDeleteError").classList.add("hidden");
}

//   this code block is obtained from https://fullcalendar.io/docs/initialize-globals for initializing the FullCalendar
let calendar;
async function initCalendar() {
  // wait for the array to get populated based on the response from the server then construct the calendar
  if (tripId) await eventsFromDB(tripId);
  // remember where the user was looking before tearing down the old instance, so re-running this after an edit/delete lands back on the same day/month instead of resetting to today
  const previousDate = calendar ? calendar.getDate() : firstEventInTrip;
  const previousView = calendar ? calendar.view.type : "dayGridMonth";

  // constants to use for event frop and event resize
  const modal = document.getElementById("dragResizeConfirmModal");
  const errorMsg = document.getElementById("dragResizeError");
  const cancelBtn = document.getElementById("cancelDragResize");
  const confirmBtn = document.getElementById("confirmDragResize");

  // destroy the previous instance first, otherwise re-running this (e.g. after an edit/delete) renders a second calendar into the same container instead of replacing the old one
  if (calendar) calendar.destroy();
  var calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    height: "100%",
    initialView: previousView,
    initialDate: previousDate,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridDay,listWeek",
    },
    events: myEvents,
    views: {
      dayGridMonth: {
        displayEventTime: false,
        displayEventEnd: false,
      },
      timeGridDay: {
        displayEventTime: true,
        displayEventEnd: true,
        eventTimeFormat: {
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        },
      },
    },
    // dateClick is a built-in FullCalendar callback, fires on any date cell click.
    // info is predefined by FullCalendar: info.dateStr = clicked date as "YYYY-MM-DD",
    // changeView(viewName, date) is a built-in method on every FullCalendar instance.
    dateClick: function (info) {
      calendar.changeView("timeGridDay", info.dateStr);
    },

    // adds a "View on Map" link to each event, only in day view (month/list
    // are too cramped for it) - eventDidMount is FullCalendar's own hook for
    // this, called once per rendered event with info.el (its DOM element)
    eventDidMount: function (info) {
      if (info.view.type !== "timeGridDay") return;
      const { lat, lng, placeId } = info.event.extendedProps;
      if (!lat || !lng) return;

      const mapLink = document.createElement("a");
      mapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${placeId || ""}`;
      // target blank redirects to new tab
      mapLink.target = "_blank";
      // .rel noopener comes with _blank target
      mapLink.rel = "noopener";
      mapLink.className =
        "text-xs underline mb-2 inline-flex items-center gap-1 shrink-0";
      // heroicons "arrow-top-right-on-square" - signals this opens elsewhere (a new tab), matching target="_blank" above
      mapLink.innerHTML = `
        View on Map
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      `;
      // stop the click from also opening the edit/delete modal (eventClick)
      mapLink.addEventListener("click", (e) => e.stopPropagation());

      // appended as a SIBLING of .fc-event-title-container (not inside it) -
      // their shared parent (.fc-event-main-frame) is flex-direction: column,
      // so this lands on its own line instead of next to the title
      info.el.querySelector(".fc-event-main-frame")?.appendChild(mapLink); // not all events have main frame (like all-day events), so we should do optional chaining for safety
    },

    // opens the edit/delete modal for the clicked event, pre-filled from
    // the event's own data
    eventClick: function (info) {
      cleanUpEventActionsModal();
      eventActionModal.showModal();
      // set the id for sending data to db easily
      eventActionModal.dataset.activityId = info.event.id;

      //title

      title.textContent = info.event.title;

      // info.event.start/end are always native Date objects, even though myEvents fed them in as strings - FullCalendar parses everything into Date internally. Use local getters (toLocalDateStr/toLocalTimeStr), not toISOString(), so these match what day view (rendered in local time) shows
      date.value = toLocalDateStr(info.event.start);
      startTime.value = toLocalTimeStr(info.event.start);
      endTime.value = toLocalTimeStr(info.event.end);

      // solo isn't a reserved FullCalendar field, so it lands in extendedProps automatically
      if (info.event.extendedProps.solo) {
        eventDeleteScope.classList.add("hidden");
      } else {
        eventDeleteScope.classList.remove("hidden");
      }
    },

    // confirms a drag (reschedule to a different day) before saving it -
    // resize (day view, edge-drag) is what owns time/duration changes, so
    // this only ever sends `date`, not startTime/endTime
    eventDrop: function (info) {
      errorMsg.classList.add("hidden");
      modal.showModal();

      // cancel is a terminal action (always closes+reverts), so it only
      // ever needs to fire once - but it also has to remove confirm's
      // listener, otherwise confirm's listener leaks (still attached, with
      // this closure's stale `info`) the next time an event gets dropped
      function onCancel() {
        confirmBtn.removeEventListener("click", onConfirm);
        modal.close();
        info.revert();
      }

      // not {once:true} - a failed save should let the user retry Confirm
      // again, not silently stop responding to clicks
      async function onConfirm() {
        if (confirmBtn.dataset.loading === "true") return;
        const dateStr = toLocalDateStr(info.event.start);

        const originalLabel = confirmBtn.textContent;
        confirmBtn.dataset.loading = "true";
        confirmBtn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;
        try {
          const response = await fetch(`/editActivity/${info.event.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: dateStr }),
          });
          if (response.ok) {
            // only remove cancel's listener once actually done - on
            // failure, both stay live so the user can retry or bail out
            cancelBtn.removeEventListener("click", onCancel);
            confirmBtn.removeEventListener("click", onConfirm);
            modal.close();
            await initCalendar();
            renderHeadsUpBanner();
          } else {
            errorMsg.textContent = await response.text();
            errorMsg.classList.remove("hidden");
          }
        } catch (error) {
          errorMsg.textContent = "Could not reach the server. Try again.";
          errorMsg.classList.remove("hidden");
        } finally {
          confirmBtn.textContent = originalLabel;
          confirmBtn.dataset.loading = "false";
        }
      }

      cancelBtn.addEventListener("click", onCancel, { once: true });
      confirmBtn.addEventListener("click", onConfirm);
    },
    eventResize: function (info) {
      errorMsg.classList.add("hidden");
      modal.showModal();

      function onCancel() {
        confirmBtn.removeEventListener("click", onConfirm); // removing the listener attached to confirm to avoid stacking
        modal.close();
        info.revert();
      }

      async function onConfirm() {
        if (confirmBtn.dataset.loading === "true") return;
        const startTime = toLocalTimeStr(info.event.start);
        const endTime = toLocalTimeStr(info.event.end);

        const originalLabel = confirmBtn.textContent;
        confirmBtn.dataset.loading = "true";
        confirmBtn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

        try {
          const response = await fetch(`/editActivity/${info.event.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime: startTime, endTime: endTime }),
          });
          if (response.ok) {
            // remove both listener on sucess to avoid stacking
            cancelBtn.removeEventListener("click", onCancel);
            confirmBtn.removeEventListener("click", onConfirm);
            modal.close();
            await initCalendar();
            renderHeadsUpBanner();
          } else {
            errorMsg.textContent = await response.text();
            errorMsg.classList.remove("hidden");
          }
        } catch (error) {
          errorMsg.textContent = "Could not reach the server. Try again.";
          errorMsg.classList.remove("hidden");
        } finally {
          confirmBtn.textContent = originalLabel;
          confirmBtn.dataset.loading = "false";
        }
      }

      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel, { once: true }); // attached and removed the first time its clicked
    },
  });
  calendar.render();
}
initCalendar();

// attach a listener to change button
const saveEventEdit = document.getElementById("saveEventEdit");
const eventEditError = document.getElementById("eventEditError");
// container of the selected trip tp get the dates from its datasets
const tripHeader = document.getElementById("tripHeader");
saveEventEdit.addEventListener("click", async () => {
  if (saveEventEdit.dataset.loading === "true") return;

  eventEditError.classList.add("hidden");
  const validationError = validateTripDates(
    undefined,
    undefined,
    undefined,
    startTime.value,
    endTime.value,
  );
  if (validationError) {
    eventEditError.textContent = validationError;
    eventEditError.classList.remove("hidden");
    return;
  }

  // eventEditDate is a single date (not a range like eventStartDate/eventEndDate) - keep it within the trip's own range

  if (
    date.value < tripHeader.dataset.startDate ||
    date.value > tripHeader.dataset.endDate
  ) {
    eventEditError.textContent = "Date must be within the trip's dates.";
    eventEditError.classList.remove("hidden");
    return;
  }

  const originalLabel = saveEventEdit.textContent;
  saveEventEdit.dataset.loading = "true";
  saveEventEdit.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

  try {
    const response = await fetch(
      `/editActivity/${eventActionModal.dataset.activityId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date.value,
          startTime: startTime.value,
          endTime: endTime.value,
        }),
      },
    );
    if (response.ok) {
      eventActionModal.close();
      await initCalendar();
      renderHeadsUpBanner();
    } else {
      eventEditError.textContent = await response.text();
      eventEditError.classList.remove("hidden");
    }
  } catch (error) {
    eventEditError.textContent = "Could not reach the server. Try again.";
    eventEditError.classList.remove("hidden");
  } finally {
    saveEventEdit.textContent = originalLabel;
    saveEventEdit.dataset.loading = "false";
  }
});

// attach a listener to delete button
const confirmEventDelete = document.getElementById("confirmEventDelete");
const eventDeleteError = document.getElementById("eventDeleteError");
confirmEventDelete.addEventListener("click", async () => {
  if (confirmEventDelete.dataset.loading === "true") return;

  const activityId = eventActionModal.dataset.activityId;
  eventDeleteError.classList.add("hidden");

  const originalLabel = confirmEventDelete.textContent;
  confirmEventDelete.dataset.loading = "true";
  confirmEventDelete.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

  try {
    // solo activities have no scope choice to read - always solo-delete them.
    // group activities read whichever scope radio is checked.
    const url = eventDeleteScope.classList.contains("hidden")
      ? `/deleteActivitySolo/${activityId}`
      : document.getElementById("eventDeleteForGroup").checked
        ? `/deleteActivityGrp/${activityId}`
        : `/deleteActivitySolo/${activityId}`;

    const response = await fetch(url, { method: "DELETE" });
    if (response.ok) {
      eventActionModal.close();
      await initCalendar();
      renderHeadsUpBanner();
    } else {
      eventDeleteError.textContent = await response.text();
      eventDeleteError.classList.remove("hidden");
    }
  } catch (error) {
    eventDeleteError.textContent = "Could not reach the server. Try again.";
    eventDeleteError.classList.remove("hidden");
  } finally {
    confirmEventDelete.textContent = originalLabel;
    confirmEventDelete.dataset.loading = "false";
  }
});

// add a new event to calendar
const addEventModal = document.getElementById("my_modal_event");
const eventDestination = document.getElementById("dest-title-event");
const eventDate = document.getElementById("eventDate");
const eventSolo = document.getElementById("eventSolo");
const eventGrp = document.getElementById("eventGrp");
const eventStartTime = document.getElementById("eventStartTime");
const eventEndTime = document.getElementById("eventEndTime");

// clean up the add new event modal
function cleanUpAddEventModal() {
  resetDestinationAutocomplete(eventDestination);
  eventSolo.checked = true;
  eventStartTime.value = "";
  eventEndTime.value = "";
  eventDate.value = "";
}

// popping up add event to calendar modal
document.getElementById("addEvent").addEventListener("click", async () => {
  // shows the trip-picker modal and bails out if no trip is selected yet (sidebar.js)
  if (!(await requireTripSelected())) return;
  // if the trip is selected show add event modal
  cleanUpAddEventModal();
  addEventModal.showModal();
});

// submit modal
const addEventBtn = document.getElementById("createAct");
const addEventError = document.getElementById("actError");
addEventBtn.addEventListener("click", async () => {
  if (addEventBtn.dataset.loading === "true") return;

  addEventError.classList.add("hidden");
  // eventDestination is the widget's container div, not an input - the
  // selected place lives in dataset.destination (set by the gmp-select
  // handler in sidebar.js), not a .value
  const validationError = validateTripDates(
    eventDestination.dataset.destination,
    undefined,
    undefined,
    eventStartTime.value,
    eventEndTime.value,
  );
  if (validationError) {
    addEventError.textContent = validationError;
    addEventError.classList.remove("hidden");
    return;
  }

  // eventDate is a single date (like eventEditDate/startDateCal, not a
  // range like the trip-creation modal) but we should still keep it within the trip's own range
  if (eventDate.value === "") {
    addEventError.textContent = "Please select a Date.";
    addEventError.classList.remove("hidden");
    return;
  } else if (
    eventDate.value < tripHeader.dataset.startDate ||
    eventDate.value > tripHeader.dataset.endDate
  ) {
    addEventError.textContent = "Date must be within the trip's dates.";
    addEventError.classList.remove("hidden");
    return;
  }

  const originalLabel = addEventBtn.textContent;
  addEventBtn.dataset.loading = "true";
  addEventBtn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

  // POST to /addToCalSolo/:tripId or /addToCalgrp/:tripId depending on
  // eventSolo/eventGrp, same request shape as code.js's addToCalBtn
  const route = eventSolo.checked ? "addToCalSolo" : "addToCalgrp";

  try {
    const response = await fetch(`/${route}/${tripId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        activityName: eventDestination.dataset.destinationName,
        date: eventDate.value,
        startTime: eventStartTime.value,
        endTime: eventEndTime.value,
        address: eventDestination.dataset.destination,
        placeId: eventDestination.dataset.placeId,
        location: {
          lat: eventDestination.dataset.lat,
          lng: eventDestination.dataset.lng,
        },
      }),
    });

    if (response.ok) {
      addEventModal.close();
      await initCalendar();
      renderHeadsUpBanner();
    } else {
      addEventError.textContent = await response.text();
      addEventError.classList.remove("hidden");
    }
  } catch (error) {
    addEventError.textContent = "Could not reach the server. Try again.";
    addEventError.classList.remove("hidden");
  } finally {
    addEventBtn.textContent = originalLabel;
    addEventBtn.dataset.loading = "false";
  }
});

// ======================================================
// api weather
// ======================================================


// markup for a single centered loading spinner, reused wherever a weather container needs one
function spinnerHtml() {
  return `<div class="w-full h-full flex items-center justify-center py-6"><span class="loading loading-spinner loading-md" style="color: #534ab7"></span></div>`;
}
// shows the spinner in both weather containers at once, before the initial fetch kicks off
function showSectionLoading() {
  document.getElementById("carouselContainer").innerHTML = spinnerHtml();
  document.getElementById("selectedDayWeather").innerHTML = spinnerHtml();
}

// request weather data
async function requestWeatherData() {
  showSectionLoading();
  const tripdestination = document.getElementById("tripHeader");
  const lat = tripdestination.dataset?.lat;
  const lng = tripdestination.dataset?.lng;
  try {
    const response = await fetch(`/getWeather`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lat: lat, lng: lng }),
    });

    if (response.ok) {
      const data = await response.json();
      // call the render function
      await renderCarouselAPI(data);
      

      // filter returns an array so we should do [0] to pick the only element inside
      const currentDayElement = [
        ...document.querySelectorAll(".carousel-item"),
      ].filter((el) => el.dataset.current === "true")[0];

      // show todays weather in the big card as deafult and highlight it
      await Promise.all([renderDetailsWeather(currentDayElement), highlightSelectedDayWeather(currentDayElement), renderHeadsUpBanner()]);

    } else {
      // show an http request error
      const carouselContainer = document.getElementById("carouselContainer");
      carouselContainer.innerHTML = `<p class="text-md text-base-content/60 text-center w-full h-full flex items-center justify-center">Failed to load data. Please try again.</p>`;
    }
  } catch (error) {
    // show a network error
    const carouselContainer = document.getElementById("carouselContainer");
    carouselContainer.innerHTML = `<p class="text-md text-base-content/60 text-center w-full h-full flex items-center justify-center">Failed to load data. Please try again.</p>`;
  }
}
document.addEventListener("tripHeaderRendered", requestWeatherData);

// gives a YYYY-MM-DD string using local date parts - unlike toISOString() (UTC), this won't roll over to the next/previous day when the local timezone is ahead of/behind UTC. en-CA happens to format dates as YYYY-MM-DD
function toLocalDateStr(date) {
  return date.toLocaleDateString("en-CA");
}

// gives a 24h HH:MM string using local time parts - same reasoning as toLocalDateStr, but for the time-of-day
function toLocalTimeStr(date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// placeholder for a missing weather icon - sizeClasses lets it stand in for either the big card icon or the small carousel icon
function dashIconSvg(sizeClasses) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="${sizeClasses}"><path d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" /></svg>`;
}

// render api results in the carousel
function renderCarouselAPI(data) {
  const carouselContainer = document.getElementById("carouselContainer");
  carouselContainer.innerHTML = "";
  data.forecastDays.forEach((item) => {
    const dateObject = new Date(item.interval.startTime);
    const dayOfWeek = dateObject.toLocaleDateString("en-US", {
      weekday: "short",
    });
    const formattedDate = dateObject.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    // mark the element with the current date as current - will be used in rendering selecteddayweather card
    const elementDate = toLocalDateStr(dateObject);
    const today = toLocalDateStr(new Date());

    let element = `<div data-full-date="${elementDate}" data-weather-desc="${item.daytimeForecast.weatherCondition?.description?.text ?? "—"}" data-day="${formattedDate}" data-day-of-week="${dayOfWeek}" data-uv="${item.daytimeForecast.uvIndex ?? "—"}" data-wind="${item.daytimeForecast.wind?.speed?.value ?? "—"}" data-feels-like-max="${item.feelsLikeMaxTemperature?.degrees ?? "—"}" data-feels-like-min="${item.feelsLikeMinTemperature?.degrees ?? "—"}" ${elementDate === today ? 'data-current="true"' : ""}
                  class="carousel-item rounded-2xl"
                  style="
                    background-color: #e0dbfb;
                    box-shadow: 0 8px 8px -6px rgba(83, 74, 183, 0.35);
                  "
                >
                  <div
                    class="flex flex-col gap-1.5 justify-between items-center p-1"
                  >
                    <h3 class="day font-semibold" style="color: #534ab7">
                      ${dayOfWeek}
                    </h3>
                    ${
                      item.daytimeForecast.weatherCondition?.iconBaseUri
                        ? `<img
                      src="${item.daytimeForecast.weatherCondition.iconBaseUri}.png"
                      alt=""
                      class="md:w-20 md:h-20 w-16 h-16 rounded-xl object-cover"
                    />`
                        : dashIconSvg("md:w-20 md:h-20 w-16 h-16 rounded-xl")
                    }
                    <!-- H/L/precip grouped into one row instead of each on its own line -->
                    <div
                      class="flex flex-row items-center gap-2 text-sm font-semibold text-base-content/70 rounded-full px-2 py-1"
                      style="background-color: #eeedfe"
                    >
                      <span class="flex items-center gap-0.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="#f97316"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M5 12l7-7 7 7M12 5v14"
                          />
                        </svg>
                        <span class="highest" style="color: #f97316">${item.maxTemperature?.degrees != null ? item.maxTemperature.degrees + "°" : "—"}</span>
                      </span>
                      <span class="flex items-center gap-0.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="#3b82f6"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M19 12l-7 7-7-7M12 19V5"
                          />
                        </svg>
                        <span class="lowest" style="color: #3b82f6">${item.minTemperature?.degrees != null ? item.minTemperature.degrees + "°" : "—"}</span>
                      </span>
                      <span class="flex items-center gap-0.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="#534ab7"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 2.75c-3.5 4.5-6 7.75-6 10.75a6 6 0 0 0 12 0c0-3-2.5-6.25-6-10.75Z"
                          />
                        </svg>
                        <span data-precip-type="${item.daytimeForecast.precipitation?.probability?.type ?? ""}" class="prec" style="color: #534ab7">${item.daytimeForecast.precipitation?.probability?.percent != null ? item.daytimeForecast.precipitation.probability.percent + "%" : "—"}</span>
                      </span>
                    </div>
                  </div>
                </div>`;
    carouselContainer.insertAdjacentHTML("beforeend", element);
  });
}

// render the big card selectedDayWeather - for current day it should fetch a different route, for upcoming dates it should use the metadata/data stashed/displayed in the carousel
async function renderDetailsWeather(element) {
  const container = document.getElementById("selectedDayWeather");
  container.innerHTML = spinnerHtml();
  try {
    if (element.dataset.current && element.dataset.current === "true") {
      // fetch a different route to get current condition
      const tripdestination = document.getElementById("tripHeader");
      const lat = tripdestination.dataset?.lat;
      const lng = tripdestination.dataset?.lng;
      const response = await fetch("/currentWeather", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lat: lat, lng: lng }),
      });
      if (response.ok) {
        const data = await response.json();
        const currentdateFormatted = new Date(
          data.currentTime,
        ).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const dayOfWeek = new Date(data.currentTime).toLocaleDateString(
          "en-US",
          {
            weekday: "short",
          },
        );

        // showing the correct info instead of hardcoded day x of your trip to los angeles
        const tripName = tripdestination.destinationName;
        // calculating which day of the trip
        const diffDays =
          Math.round(
            (new Date(data.currentTime).getTime() -
              new Date(
                tripdestination.dataset.startDate + "T00:00:00",
              ).getTime()) /
              86400000,
          ) + 1;
        // small inline placeholder for any field the api didn't return - reused wherever a single stat (not the big icon) might be missing
        const dashIcon = dashIconSvg("inline-block h-4 w-4 align-middle");
        let html = `<div class="card-body items-start p-4 md:p-6 gap-3 md:gap-4">
                  <div class="flex flex-col gap-1">
                    <h2
                      id="selectedDate"
                      class="card-title text-base md:text-xl"
                      style="color: #534ab7"
                    >
                      ${dayOfWeek.toUpperCase()}, ${currentdateFormatted.toUpperCase()}
                    </h2>
                    ${
                      diffDays >= 1
                        ? `<p class="text-sm md:text-base text-base-content/60">
                      Day <span class="text-base-content">${diffDays}</span> of your trip
                      to
                      <span class="text-base-content">${tripName}</span>
                    </p>`
                        : ""
                    }
                  </div>

                  <!-- icon + current temp+ lowest highest -->
                  <div
                    class="flex flex-row md:items-center items-stretch justify-start gap-4 md:gap-10"
                  > ${
                    data.weatherCondition?.iconBaseUri
                      ? `<img
                        src="${data.weatherCondition.iconBaseUri}.png"
                        alt="Weather icon"
                        class="rounded-xl md:w-50 w-40 shrink-0 object-cover"
                      />`
                      : dashIconSvg("md:w-50 w-24 shrink-0")
                  }
                    
                    <div class="flex flex-col gap-2 justify-start">
                      <p
                        id="currentTemp"
                        class="md:text-6xl text-3xl font-bold"
                      >
                        ${data.temperature?.degrees != null ? data.temperature.degrees + "°" : dashIcon}
                      </p>
                      <p id="status" class="font-semibold text-base-content/70">
                        ${data.weatherCondition?.description?.text ?? dashIcon}
                      </p>

                      <!-- feels like, lowest, highest -->
                      <div
                        class="flex md:flex-row flex-col gap-1 text-base-content/60"
                      >
                        <p class="font-semibold">
                          Feels like:
                          <span style="color: #534ab7" id="feelsLike">${data.feelsLikeTemperature?.degrees != null ? data.feelsLikeTemperature.degrees + "°" : dashIcon}</span>
                        </p>
                        <p class="font-semibold">
                          H:
                          <span style="color: #f97316" id="highest">${data.currentConditionsHistory?.maxTemperature?.degrees != null ? data.currentConditionsHistory.maxTemperature.degrees + "°" : dashIcon}</span>
                        </p>
                        <p class="font-semibold">
                          L: <span style="color: #3b82f6" id="lowest">${data.currentConditionsHistory?.minTemperature?.degrees != null ? data.currentConditionsHistory.minTemperature.degrees + "°" : dashIcon}</span>
                        </p>
                      </div>
                      <!-- end of feels like etc. -->
                    </div>
                  </div>

                  <!-- other data -->
                  <div
                    class="flex flex-row justify-between items-center border-t border-base-200 w-full pt-2"
                  >
                    <div class="flex flex-col gap-1 items-start justify-start">
                      <p
                        id="precip"
                        class="text-xs uppercase tracking-wide text-base-content/60"
                      >
                        Precip
                      </p>
                      <p class="font-semibold">${data.precipitation?.probability?.percent != null ? data.precipitation.probability.percent + "%" : dashIcon}</p>
                    </div>
                    <div class="flex flex-col gap-1 items-start justify-start">
                      <p
                        id="uvInd"
                        class="text-xs uppercase tracking-wide text-base-content/60"
                      >
                        UV Index
                      </p>
                      <p class="font-semibold">${data.uvIndex != null ? data.uvIndex : dashIcon}</p>
                    </div>
                    <div class="flex flex-col gap-1 items-start justify-start">
                      <p
                        id="wind"
                        class="text-xs uppercase tracking-wide text-base-content/60"
                      >
                        Wind
                      </p>
                      <p class="font-semibold">${data.wind?.speed?.value != null ? data.wind.speed.value + " mph" : dashIcon}</p>
                    </div>
                  </div>
                </div>`;
        container.innerHTML = html;
      } else {
        let html = `<div class="card-body items-start p-4 md:p-6 gap-3 md:gap-4">
                        <p
                          class="text-md text-base-content/60 mt-1 text-center mb-2 w-full"
                        >Failed to load data. Please try again.</p>
                    </div>`;
        container.innerHTML = html;
      }
    } else {
      const iconEl = element.querySelector("img");
      const highest = element.querySelector(".highest").textContent;
      const lowest = element.querySelector(".lowest").textContent;
      const precip = element.querySelector(".prec").textContent;

      const tripdestination = document.getElementById("tripHeader");
      const tripName = tripdestination.destinationName;
      const diffDays =
        Math.round(
          (new Date(element.dataset.fullDate + "T00:00:00").getTime() -
            new Date(
              tripdestination.dataset.startDate + "T00:00:00",
            ).getTime()) /
            86400000,
        ) + 1;

      let html = `<div class="card-body items-start p-4 md:p-6 gap-3 md:gap-4">
                  <div class="flex flex-col gap-1">
                    <h2
                      id="selectedDate"
                      class="card-title text-base md:text-xl"
                      style="color: #534ab7"
                    >
                      ${element.dataset.dayOfWeek.toUpperCase()}, ${element.dataset.day.toUpperCase()}
                    </h2>
                    ${
                      diffDays >= 1
                        ? `<p class="text-sm md:text-base text-base-content/60">
                      Day <span class="text-base-content">${diffDays}</span> of your trip
                      to
                      <span class="text-base-content">${tripName}</span>
                    </p>`
                        : ""
                    }
                  </div>

                  <!-- icon + current temp+ lowest highest -->
                  <div
                    class="flex flex-row items-stretch justify-start gap-4 md:gap-10"
                  >
                    ${
                      iconEl
                        ? `<img
                      src="${iconEl.src}"
                      alt="Weather icon"
                      class="rounded-xl md:w-50 w-30 shrink-0 object-cover"
                    />`
                        : dashIconSvg("md:w-50 w-24 shrink-0")
                    }
                    <div class="flex flex-col gap-2 justify-start">
                      <p
                        id="currentTemp"
                        class="md:text-6xl text-3xl font-bold"
                      >
                      ${lowest} - ${highest}
                      </p>
                      <p id="status" class="font-semibold text-base-content/70">
                        ${element.dataset.weatherDesc}
                      </p>

                      <!-- feels like, lowest, highest -->
                      <div
                        class="flex md:flex-row flex-col gap-1 text-base-content/60"
                      >
                        <p class="font-semibold">
                          Feels like:
                          <span style="color: #534ab7" id="feelsLike">${element.dataset.feelsLikeMin}° - ${element.dataset.feelsLikeMax}°</span>
                        </p>
                        <p class="font-semibold">
                          H:
                          <span style="color: #f97316" id="highest">${highest}</span>
                        </p>
                        <p class="font-semibold">
                          L: <span style="color: #3b82f6" id="lowest">${lowest}</span>
                        </p>
                      </div>
                      <!-- end of feels like etc. -->
                    </div>
                  </div>

                  <!-- other data -->
                  <div
                    class="flex flex-row justify-between items-center border-t border-base-200 w-full pt-2"
                  >
                    <div class="flex flex-col gap-1 items-start justify-start">
                      <p
                        id="precip"
                        class="text-xs uppercase tracking-wide text-base-content/60"
                      >
                        Precip
                      </p>
                      <p class="font-semibold">${precip}</p>
                    </div>
                    <div class="flex flex-col gap-1 items-start justify-start">
                      <p
                        id="uvInd"
                        class="text-xs uppercase tracking-wide text-base-content/60"
                      >
                        UV Index
                      </p>
                      <p class="font-semibold">${element.dataset.uv}</p>
                    </div>
                    <div class="flex flex-col gap-1 items-start justify-start">
                      <p
                        id="wind"
                        class="text-xs uppercase tracking-wide text-base-content/60"
                      >
                        Wind
                      </p>
                      <p class="font-semibold">${element.dataset.wind} mph</p>
                    </div>
                  </div>
                </div>`;
      container.innerHTML = html;
    }
  } catch (error) {
    container.innerHTML = `<div class="card-body items-start p-4 md:p-6 gap-3 md:gap-4">
                        <p
                          class="text-md text-base-content/60 mt-1 text-center mb-2 w-full"
                        >Failed to load data. Please try again.</p>
                    </div>`;
  }
}
// attach a listener to the carousel using delegation
document
  .getElementById("carouselContainer")
  .addEventListener("click", async (event) => {
    [
      ...document
        .getElementById("carouselContainer")
        .querySelectorAll(".carousel-item"),
    ].map((child) => resetHighlightedDayWeather(child));
    const targetElement = event.target.closest(".carousel-item");
    highlightSelectedDayWeather(targetElement);
    await renderDetailsWeather(targetElement);
  });

// function to highlight each element in the carousel
function highlightSelectedDayWeather(element) {
  element.style.backgroundColor = "#534ab7";
  element.querySelector("h3").style.color = "white";
}

// function to clearup any highlighting in the carousel
function resetHighlightedDayWeather(element) {
  element.style.backgroundColor = "#e0dbfb";
  element.querySelector("h3").style.color = "";
}

// =========================================================
// populating headsup section
// =========================================================
// cross-references calendar events with risky-weather days from the carousel and returns the matches
function matchEventsWithWeather() {
  // calendar has module scope, we can use .getEvents() to get all the events without connecting to the server again - returns an array
  const allEvents = calendar.getEvents();

  // get the carouselItems(divs with carousel-item class) with percipitation above 50%
  const carouselItems = [...document.querySelectorAll(".carousel-item")].filter(
    (item) =>
      Number(item.querySelector(".prec").textContent.replace("%", "")) > 50,
  );

  const carouselItemsDays = carouselItems.map((item) => ({
    date: item.dataset.fullDate,
    chance: item.querySelector(".prec").textContent,
    type: item.querySelector("[data-precip-type]").dataset.precipType,
  }));
  // find out which events are going to happen in the next 10 days that we have the weather info for
  const notifyEvents = allEvents.filter((event) =>
    carouselItemsDays.some((day) => day.date === toLocalDateStr(event.start)),
  );
  // pair each matching event back up with that date's weather info for the heads-up card
  const notifyInfo = notifyEvents.map((event) => {
    const dateStr = toLocalDateStr(event.start);
    const weatherDay = carouselItemsDays.find((day) => day.date === dateStr);
    return {
      title: [event.title],
      date: dateStr,
      chance: weatherDay.chance,
      type: weatherDay.type?.toLowerCase().replaceAll("_", " ") ?? "",
    };
  });

  // combine events that fall on the same day into one entry
  const result = [];
  notifyInfo.forEach((info) => {
    const existing = result.find((item) => item.date === info.date);
    if (!existing) {
      result.push(info);
    } else {
      existing.title.push(...info.title);
    }
  });
  return result;
}

// render the heads up card
function renderHeadsUpBanner() {
  const allInfo = matchEventsWithWeather();
  const container = document.getElementById("weatherHeadsUp");
  if (allInfo.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.innerHTML = "";
  container.classList.remove("hidden");
  allInfo.forEach((info) => {
    const title = info.title.join(", ");
    const formattedDate = new Date(info.date + "T00:00:00").toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      },
    );
    let html = `<p>
                 ⚠️ ${info.chance} chance of ${info.type} on day ${formattedDate} during your
                  ${title} plans.
                </p>`;
    container.insertAdjacentHTML("beforeend", html);
  });
}
