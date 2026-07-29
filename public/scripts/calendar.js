let myEvents = [];
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

//   this code block is obtained from https://fullcalendar.io/docs/initialize-globals for initializing the FullCalendar
let calendar;
async function initCalendar() {
  // wait for the array to get populated based on the response from the server then construct the calendar
  if (tripId) await eventsFromDB(tripId);
  // remember where the user was looking before tearing down the old instance, so re-running this after an edit/delete lands back on the same day/month instead of resetting to today
  const previousDate = calendar ? calendar.getDate() : undefined;
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
      right: "dayGridMonth,timeGridDay",
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
    // opens the edit/delete modal for the clicked event, pre-filled from
    // the event's own data
    eventClick: function (info) {
      eventActionModal.showModal();
      // set the id for sending data to db easily
      eventActionModal.dataset.activityId = info.event.id;

      //title

      title.textContent = info.event.title;

      if (document.getElementById("eventAction-edit").checked) {
        // info.event.start/end are always native Date objects, even though myEvents fed them in as strings - FullCalendar parses everything into Date internally, hence .toISOString() instead of .slice()/.split() directly

        date.value = info.event.start.toISOString().slice(0, 10);

        startTime.value = info.event.start
          .toISOString()
          .split("T")[1]
          .slice(0, 5);

        endTime.value = info.event.end.toISOString().split("T")[1].slice(0, 5);
      } else if (document.getElementById("eventAction-delete").checked) {
        // solo isn't a reserved FullCalendar field, so it lands in extendedProps automatically
        if (info.event.extendedProps.solo) {
          eventDeleteScope.classList.add("hidden");
        } else {
          eventDeleteScope.classList.remove("hidden");
        }
      }
    },
  });
  calendar.render();
}
initCalendar();

// attach a listener to change button
const saveEventEdit = document.getElementById("saveEventEdit");
const eventEditError = document.getElementById("eventEditError");
saveEventEdit.addEventListener("click", async () => {
  if (saveEventEdit.dataset.loading === "true") return;

  eventEditError.classList.add("hidden");
  if (!startTime.value) {
    eventEditError.textContent = "Please select a Time.";
    eventEditError.classList.remove("hidden");
    return;
  }
  if (!endTime.value) {
    eventEditError.textContent = "Please select an End Time.";
    eventEditError.classList.remove("hidden");
    return;
  }
  if (endTime.value <= startTime.value) {
    eventEditError.textContent = "End Time must be after Start Time.";
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
