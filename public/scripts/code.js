// fetching the user info for their Id to build peronalized invitation links
let myId;
async function getMyId() {
  if (!myId) {
    const me = await (await fetch("/userInfo")).json();
    myId = me.id;
  }
  return myId;
}

document.getElementById("addTrip").addEventListener("click", () => {
  // clear any leftover edit state so this opens as a fresh "create" form
  const modal = document.getElementById("my_modal_trip");
  delete modal.dataset.editingTripId;
  document.getElementById("tripTitle").textContent = "Add a New Trip";
  document.getElementById("createTrip").textContent = "Create Trip";
  document.getElementById("dest-title").value = "";
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  modal.showModal();
});

// invitation logic for the button that appears next to each single trip
document
  .getElementById("tripHeader")
  .addEventListener("click", async (event) => {
    const currentTrip = event.target.closest("#inviteTrip");
    if (!currentTrip) return;
    const currentTripId = currentTrip.closest("#tripHeader").dataset.tripId;
    document.getElementById("inviteModal").showModal();
    document.getElementById("link").value =
      `${window.location.origin}/join.html?trip=${currentTripId}&from=${await getMyId()}`;
  });

// checks destination/date inputs for create and edit trip forms, returns an
// error message to show the user or null if everything's valid
function validateTripDates(destination, startDate, endDate) {
  // get todays date in yyyy-mm-dd format
  const todayDate = new Date().toISOString().slice(0, 10);

  if (destination.trim() === "") {
    return "Please Enter your destination.";
  } else if (!startDate || !endDate) {
    return "Please select both a start and end date.";
  } else if (endDate <= startDate) {
    return "End date must be after the start date.";
  } else if (startDate < todayDate) {
    return "Start date can't be in the past.";
  }
  return null;
}

// get the data from submitted modal
document
  .getElementById("createTrip")
  .addEventListener("click", async (event) => {
    const destination = document.getElementById("dest-title").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const tripError = document.getElementById("tripError");
    tripError.classList.add("hidden");

    const errorMessage = validateTripDates(destination, startDate, endDate);
    if (errorMessage) {
      tripError.textContent = errorMessage;
      tripError.classList.remove("hidden");
      return;
    }

    const btn = event.currentTarget;
    if (btn.dataset.loading === "true") return; // guard against double-click

    const originalLabel = btn.innerHTML;
    btn.dataset.loading = "true";
    btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    const modal = document.getElementById("my_modal_trip");
    const editingTripId = modal.dataset.editingTripId;

    if (editingTripId) {
      // editing an existing trip
      const response = await fetch(`/editTrip/${editingTripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination: destination,
          startDate: startDate,
          endDate: endDate,
        }),
      });

      if (response.ok) {
        delete modal.dataset.editingTripId;
        modal.close();
        await getSingleTripDetails(editingTripId);
        await loadYourTrips();
      } else {
        tripError.textContent = "Could not update the trip, please try again.";
        tripError.classList.remove("hidden");
      }

      btn.dataset.loading = "false";
      btn.innerHTML = originalLabel;
      return;
    }

    // creating a new trip
    const response = await fetch("/addTrip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destination: destination,
        startDate: startDate,
        endDate: endDate,
      }),
    });
    if (response.ok) {
      const data = await response.json();

      // clear the form so the next "+ New Trip" opens blank, not with this trip's info
      document.getElementById("dest-title").value = "";
      document.getElementById("startDate").value = "";
      document.getElementById("endDate").value = "";

      // close the previous modal
      modal.close();
      // show the invite link after trip was submitted successfully
      document.getElementById("inviteModal").showModal();
      document.getElementById("link").value =
        `${window.location.origin}/join.html?trip=${data}&from=${await getMyId()}`;
      loadYourTrips();
    } else {
      tripError.textContent = "Could not add the trip, please try again.";
      tripError.classList.remove("hidden");
    }

    btn.dataset.loading = "false";
    btn.innerHTML = originalLabel;
  });

// add functionality to copy button in the modal
document
  .getElementById("inviteModal")
  .addEventListener("click", async (event) => {
    const copyBtn = event.target.closest("#joinBtn");
    const linkElement = document.getElementById("link");

    const errorMsg = document.getElementById("errorInvite");
    errorMsg.classList.add("hidden");

    const text = linkElement.value;

    try {
      // navigator.clipboard.writeText is the async Clipboard API
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    } catch (error) {
      errorMsg.textContent = "Could not copy the link. try again.";
      errorMsg.classList.remove("hidden");
    }
  });

// this function gets the start date and end date and provide formatted data that will be used to show dates of
// the trips in the side bar
function formatTripDates(startStr, endStr) {
  // for turning a plain string such as "2022-08-11" to a date we should append T00:00:00 to it
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");

  // arrow function to get only month and day
  // date.toLocaleDateString(locale, formatoptions)
  const monthDay = (date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // arrow function to get month, day, and the year
  const fullDate = (date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // showing the compact version of the date such as jul 17 - 20 or jul 17 - sep 20
  // getDate gives the day of the month (getDay would give the day of the week instead)
  // this info is used in "your trips section"
  const compact =
    start.getMonth() === end.getMonth()
      ? `${monthDay(start)} - ${end.getDate()}`
      : `${monthDay(start)} - ${monthDay(end)}`;

  // showing the full version of date such as jul 20 - jul 23 , 2025 for trip details
  const full = `${monthDay(start)} - ${fullDate(end)}`;

  //computing the nights for trip details
  // subtracting 2 date objects gives us the total value in milliseconds that we should divide by the
  // total number of milliseconds in a day (1000 ms/sec × 60 sec/min × 60 min/hr × 24 hr/day)
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));

  return { compact, full, nights };
}

// loading "your trips" in the side bar
async function loadYourTrips() {
  const data = await (await fetch("/allTrips")).json();
  const container = document.getElementById("yourTrips");
  container.innerHTML = "";
  data.forEach((trip) => {
    const startDate = trip.startDate.slice(0, 10); // gives sth like 2017-08-19
    const endDate = trip.endDate.slice(0, 10);
    const dateRange = formatTripDates(startDate, endDate);
    let element = "";
    element += `<div id ="${trip._id}"
                class="trip flex flex-row items-center justify-between gap-2 text-sm font-medium text-white px-2.5 py-2 rounded-xl hover:cursor-pointer hover:bg-[rgba(255,255,255,0.08)]"
              >
                <span>${trip.destination.charAt(0).toUpperCase() + trip.destination.slice(1)}</span
                ><span class="text-xs font-normal text-white/70"
                  >${dateRange.compact}</span
                >
              </div>`;
    container.insertAdjacentHTML("beforeend", element);
  });
}

loadYourTrips();

// highlights the clicked trip in the sidebar and un-highlights the rest
async function yourTripsStyle(event) {
  const element = event.target.closest(".trip");
  if (!element) return;

  // clear the style of bg of other elements if they exist
  const otherElements = [
    ...element.closest("#yourTrips").querySelectorAll(".trip"),
  ];
  otherElements.map((element) => (element.style.background = "transparent"));
  // add a bg color to selected trip
  element.style.background = "rgba(255, 255, 255, 0.16)";

  return element;
}
document
  .getElementById("yourTrips")
  .addEventListener("click", async (event) => {
    const element = await yourTripsStyle(event);
    if (!element) return;
    await getSingleTripDetails(element.id);
  });

// fetches the selected trip's details and renders them into #tripHeader
async function getSingleTripDetails(tripId) {
  const trip = await (await fetch(`/singleTripDetails/${tripId}`)).json();
  const container = document.getElementById("tripHeader");
  container.dataset.tripId = tripId;

  const start = trip.startDate.slice(0, 10);
  const end = trip.endDate.slice(0, 10);
  const dateInfo = formatTripDates(start, end);

  container.innerHTML = "";
  let addedElement = `<h2
                class="flex flex-row items-baseline justify-between gap-2 text-base font-semibold text-white"
              >
                <span>${trip.destination}</span
                ><span class="text-sm font-normal text-white">${dateInfo.compact}</span>
              </h2>
              <!-- card containing the trip info -->
              <div class="card flex-1 bg-base-100 card-xs shadow-sm">
                <div class="card-body">
                  <div class="flex flex-row items-start justify-between gap-2">
                    <div>
                      <h2 id="destName" class="card-title">${trip.destination}</h2>
                      <p id="tripDate">${dateInfo.full}</p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        id="inviteTrip"
                        class="btn btn-ghost btn-xs btn-square"
                        aria-label="Invite people"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"
                          />
                        </svg>
                      </button>
                      <button
                        id="editTrip"
                        class="btn btn-ghost btn-xs btn-square"
                        aria-label="Edit trip"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                          />
                        </svg>
                      </button>
                      <button
                        id="deleteTrip"
                        class="btn btn-ghost btn-xs btn-square text-error"
                        aria-label="Delete trip"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="flex flex-row gap-1">
                    <div
                      id="nights"
                      class="badge badge-secondary text-xs rounded-full p-2"
                    >
                      ${dateInfo.nights} nights
                    </div>
                    <div
                      id="people"
                      class="badge badge-success text-xs rounded-full p-2"
                    >
                      ${trip.people.length} person(s)
                    </div>
                  </div>
                </div>
              </div>`;
  container.insertAdjacentHTML("beforeend", addedElement);
}

// sends the actual delete request for a trip id, called only after the user confirms
async function deleteTrip(id) {
  return fetch(`/deleteTrip/${id}`, { method: "DELETE" });
}

// clicking the trip header's delete icon opens the confirmation modal instead of
// deleting right away - #deleteTrip only exists once a trip is rendered into
// #tripHeader, so this listener has to live on the static #singleTripInfo container
document.getElementById("singleTripInfo").addEventListener("click", (event) => {
  if (!event.target.closest("#deleteTrip")) return;
  document.getElementById("deleteTripError").classList.add("hidden");
  document.getElementById("deleteTripConfirmModal").showModal();
});

// the modal's own delete button - this is what actually calls the delete route
document
  .getElementById("confirmDeleteTrip")
  .addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    if (btn.dataset.loading === "true") return; // guard against double-click

    // swap the button label for a spinner while the request is in flight
    const originalLabel = btn.innerHTML;
    btn.dataset.loading = "true";
    btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    // the currently selected trip's id is stashed on #tripHeader when it's rendered
    const tripId = document.getElementById("tripHeader").dataset.tripId;
    const response = await deleteTrip(tripId);

    if (response.ok) {
      // close the modal and clear the now-deleted trip's header before
      // refreshing the sidebar so nothing stale is left on screen
      document.getElementById("deleteTripConfirmModal").close();
      document.getElementById("tripHeader").innerHTML = "";
      await loadYourTrips();
    } else {
      // leave the modal open on failure so the user can retry without re-confirming
      const deleteTripError = document.getElementById("deleteTripError");
      deleteTripError.textContent = "Failed to delete trip. Please try again.";
      deleteTripError.classList.remove("hidden");
    }

    btn.dataset.loading = "false";
    btn.innerHTML = originalLabel;
  });

async function editTripSetup(id) {
  const data = await (await fetch(`/singleTripDetails/${id}`)).json();

  // show the my_modal_trip with some modification
  document.getElementById("my_modal_trip").showModal();
  document.getElementById("my_modal_trip").dataset.editingTripId = id;
  document.getElementById("tripTitle").innerHTML = "Edit Trip";
  document.getElementById("createTrip").innerHTML = "Confirm";
  document.getElementById("dest-title").value = data.destination;
  document.getElementById("startDate").value = data.startDate.slice(0, 10);
  document.getElementById("endDate").value = data.endDate.slice(0, 10);
}

document
  .getElementById("tripHeader")
  .addEventListener("click", async (event) => {
    const createBtn = event.target.closest("#editTrip");
    if (!createBtn) return;
    const id = createBtn.closest("#tripHeader").dataset.tripId;
    await editTripSetup(id);
  });
