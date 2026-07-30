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
          address: obj.address,
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

      // info.event.start/end are always native Date objects, even though myEvents fed them in as strings - FullCalendar parses everything into Date internally, hence .toISOString() instead of .slice()/.split() directly
      date.value = info.event.start.toISOString().slice(0, 10);
      startTime.value = info.event.start
        .toISOString()
        .split("T")[1]
        .slice(0, 5);
      endTime.value = info.event.end.toISOString().split("T")[1].slice(0, 5);

      // solo isn't a reserved FullCalendar field, so it lands in extendedProps automatically
      if (info.event.extendedProps.solo) {
        eventDeleteScope.classList.add("hidden");
      } else {
        eventDeleteScope.classList.remove("hidden");
      }
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
        activityName: eventDestination.dataset.destination,
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
