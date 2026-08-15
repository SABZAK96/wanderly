// restore the last-selected trip (if any) so switching pages doesn't lose it
const storedTripId = localStorage.getItem("selectedTripId");
if (storedTripId) {
  getSingleTripDetails(storedTripId);
  getRecentActivities(storedTripId);
}

// =====================================================================================================
// validate the city user enters as the destination using google places api autocomplete
// this is for making sure that the data is correct for using it ion the suggestiuon section
// =====================================================================================================

// this function is to insert the script tag for using autocomplete feature in the googleplaces API - the intention of this is not to expose our api key and fetch it from the server instead
async function loadPlacesLibrary() {
  // const { key } = obj uses object destructuring to extract the key property from an object, which is shorthand for const key = obj.key;
  const { key } = await (await fetch("/config/places-key")).json();
  const script = document.createElement("script");
  script.async = true;
  // callback is the name of a global function to be called once the Maps JavaScript API loads completely - which is initAutocomplete
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places&callback=initAutocomplete`;
  document.head.appendChild(script);
}

loadPlacesLibrary();

// function for making a call to google places api - source: google places documentation with some modification to integrate it with my codebase
// no need to call this function since it would be called auromatically once the script tag from above loads
const container = document.getElementById("dest-title");

// sets up every .dest-autocomplete box once the Places library is actually ready - see notes/working-with-google-places-case-studies.md Part 7
async function initAutocomplete() {
  document.querySelectorAll(".dest-autocomplete").forEach(setUpAutocomplete);
}

function setUpAutocomplete(container) {
  // no bare global for this - it's namespaced under google.maps.places, see notes/working-with-google-places-case-studies.md Part 3
  const { PlaceAutocompleteElement } = google.maps.places;

  // Create the input HTML element, and append it.
  const placeAutocomplete = new PlaceAutocompleteElement();
  placeAutocomplete.placeholder =
    container.dataset.placeholder || "e.g. Tokyo, Japan";
  container.appendChild(placeAutocomplete);

  // Add the gmp-select listener
  placeAutocomplete.addEventListener(
    "gmp-select",
    async ({ placePrediction }) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });
      // stored on dataset (not a closure variable) so resetDestinationAutocomplete can clear it from outside this function
      container.dataset.lastConfirmedValue = place.formattedAddress;
      container.dataset.destination = place.formattedAddress;
      container.dataset.destinationName = place.displayName;
      container.dataset.lat = place.location.lat();
      container.dataset.lng = place.location.lng();
    },
  );

  // typing after a selection means that selection is no longer valid -
  // clear dataset.destination so the existing "Please Enter your
  // destination." check in validateTripDates (sidebar.js) blocks
  // submitting an unselected/garbage destination, instead of silently
  // reusing whatever place was selected before the user started editing.
  // Compares against dataset.lastConfirmedValue rather than unconditionally
  // clearing, since selecting a suggestion may itself fire "input" -
  // only clear when the visible text has actually diverged from the last
  // real selection
  placeAutocomplete.addEventListener("input", () => {
    if (placeAutocomplete.value !== container.dataset.lastConfirmedValue) {
      container.dataset.destination = "";
      container.dataset.destinationName = "";
      container.dataset.lat = "";
      container.dataset.lng = "";
    }
  });
}

// clears a destination-autocomplete container back to blank: the widget's own
// displayed text, dataset.destination/lat/lng, and dataset.lastConfirmedValue
function resetDestinationAutocomplete(container) {
  const widget = container.querySelector("gmp-place-autocomplete");
  if (widget) widget.value = "";
  container.dataset.destination = "";
  container.dataset.destinationName = "";
  container.dataset.lat = "";
  container.dataset.lng = "";
  container.dataset.lastConfirmedValue = "";
}

// expense.js (a module, so it can't call getSingleTripDetails directly) fires
// this whenever a placeholder person is added/removed, so the sidebar's
// people-count badge stays in sync without waiting for a trip re-select
document.addEventListener("peopleChanged", (e) => {
  getSingleTripDetails(e.detail.tripId);
});

// fetching the user info for their Id to build peronalized invitation links
let myId;
async function getMyId() {
  if (!myId) {
    const me = await (await fetch("/userInfo")).json();
    myId = me.id;
  }
  return myId;
}

// ====================================================================
// (#my_modal_suggest) - shared by
// plan/calendar/expense, not present on account/settings
// ====================================================================

// loads the user's trips into #addedTrips for the picker
async function loadTrips() {
  const data = await (await fetch("/allTrips")).json();
  const container = document.getElementById("addedTrips");
  container.innerHTML = "";
  data.forEach((trip) => {
    const startDate = trip.startDate.slice(0, 10); // gives sth like 2017-08-19
    const endDate = trip.endDate.slice(0, 10);
    const dateRange = formatTripDates(startDate, endDate);
    let element = "";
    element += `<div data-id ="${trip._id}"
                class="card suggest flex flex-row items-center justify-between gap-2 text-sm font-medium  px-2.5 py-2 rounded-xl hover:cursor-pointer hover:border-2 hover:border-[#3c3489] text-[#3c3489] bg-[#eeedfe]"
              >
                <span>${trip.destination.charAt(0).toUpperCase() + trip.destination.slice(1)}</span
                ><span class="text-xs font-normal"
                  >${dateRange.compact}</span
                >
              </div>`;
    container.insertAdjacentHTML("beforeend", element);
  });
}

const suggestModal = document.getElementById("my_modal_suggest");

// forces the user to pick (or create) a trip before a trip-scoped action
// proceeds - callers on pages with the modal (plan/calendar/expense) call
// this and bail out if it returns false
async function requireTripSelected() {
  if (localStorage.getItem("selectedTripId")) return true;
  await loadTrips();
  suggestModal.showModal();
  return false;
}

// expense.js is a module and can't call requireTripSelected() directly -
// it dispatches this event instead when it needs the picker shown
document.addEventListener("requireTripPick", () => {
  loadTrips().then(() => suggestModal.showModal());
});

// #my_modal_suggest doesn't exist on account.html/settings.html - skip wiring it up there

if (suggestModal) {
  // open up the add-a-new-trip modal once "create a new trip" is clicked from the picker
  suggestModal.addEventListener("click", (event) => {
    const btn = event.target.closest("#createTripinPickModal");
    if (!btn) return; // click was somewhere else in the modal (close button, backdrop, a trip card)
    document.getElementById("my_modal_trip").showModal();
    suggestModal.close();
  });

  // picking a trip from the list
  suggestModal.addEventListener("click", (event) => {
    // remove all the borders first
    suggestModal.querySelectorAll(".suggest").forEach((element) => {
      element.classList.contains("border-2") &&
        element.classList.remove("border-2");
    });
    const selectedTrip = event.target.closest(".suggest");
    if (!selectedTrip) return;

    selectedTrip.classList.add("border-2", "border-[#3c3489]");
    localStorage.setItem("selectedTripId", selectedTrip.dataset.id);
    onTripPickedFromSuggestModal(selectedTrip.dataset.id);
    suggestModal.close();
  });
}

// updates the sidebar after a trip is picked from the "pick a trip first"
// modal - see notes/suggest-modal-trip-picker.md
function onTripPickedFromSuggestModal(tripId) {
  document.dispatchEvent(
    new CustomEvent("changeTrip", { detail: { tripId } }),
  );
  getSingleTripDetails(tripId);
  getRecentActivities(tripId);
  const element = document.querySelector(`#yourTrips [id="${tripId}"]`);
  // element can be null - this file's own loadYourTrips() may not have
  // resolved yet when this fires
  if (element) highlightTrip(element);
}

document.getElementById("addTrip").addEventListener("click", () => {
  // clear any leftover edit state so this opens as a fresh "create" form
  const modal = document.getElementById("my_modal_trip");
  delete modal.dataset.editingTripId;
  document.getElementById("tripTitle").textContent = "Add a New Trip";
  document.getElementById("createTrip").textContent = "Create Trip";
  resetDestinationAutocomplete(document.getElementById("dest-title"));
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  modal.showModal();
});

// checks destination/date inputs for create and edit trip forms, returns an
// error message to show the user or null if everything's valid
function validateTripDates(
  destination,
  startDate,
  endDate,
  startTime,
  endTime,
) {
  // get todays date in yyyy-mm-dd format
  const todayDate = new Date().toISOString().slice(0, 10);

  // same undefined-vs-"" distinction as the dates/time below - skip when the caller isn't validating a destination at all
  if (destination !== undefined && destination.trim() === "") {
    return "Please Enter your destination.";
  }

  // undefined means the caller didn't pass dates at all (skip); "" means it did, and the user left it blank
  if (startDate !== undefined && endDate !== undefined) {
    if (startDate === "") {
      return "Please select a Start Date.";
    } else if (endDate === "") {
      return "Please select an End Date.";
    } else if (endDate <= startDate) {
      return "End date must be after the start date.";
    } else if (startDate < todayDate) {
      return "Start date can't be in the past.";
    }
  }

  // same undefined-vs-"" distinction as the dates above
  if (startTime !== undefined && endTime !== undefined) {
    if (startTime === "") {
      return "Please select a Start Time.";
    } else if (endTime === "") {
      return "Please select an End Time.";
    } else if (startTime >= endTime) {
      return "End time must be after the start time.";
    }
  }
  return null;
}

// get the data from submitted modal
document
  .getElementById("createTrip")
  .addEventListener("click", async (event) => {
    const destination =
      document.getElementById("dest-title").dataset.destination;
    const destinationName =
      document.getElementById("dest-title").dataset.destinationName;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const lat = container.dataset.lat;
    const lng = container.dataset.lng;

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
          destinationName: destinationName,
          startDate: startDate,
          endDate: endDate,
          lat: lat,
          lng: lng,
        }),
      });

      if (response.ok) {
        delete modal.dataset.editingTripId;
        modal.close();
        await getSingleTripDetails(editingTripId);
        await loadYourTrips();
        getRecentActivities(editingTripId);
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
        destinationName: destinationName,
        startDate: startDate,
        endDate: endDate,
        lat: lat,
        lng: lng,
      }),
    });
    if (response.ok) {
      const data = await response.json(); // data is the trip._id coming back from the db
      localStorage.setItem("selectedTripId", data);
      document.dispatchEvent(new CustomEvent("tripAdded", { detail: { tripId: data } }));
      await getSingleTripDetails(data);
      getRecentActivities(data);
      // clear the form so the next "+ New Trip" opens blank, not with this trip's info
      resetDestinationAutocomplete(document.getElementById("dest-title"));
      document.getElementById("startDate").value = "";
      document.getElementById("endDate").value = "";

      // close the previous modal
      modal.close();
      // show the invite link after trip was submitted successfully - #inviteModal
      // only exists on plan.html, so skip this on pages that don't have it
      const inviteModal = document.getElementById("inviteModal");
      if (inviteModal) {
        inviteModal.showModal();
        document.getElementById("link").value =
          `${window.location.origin}/join.html?trip=${data}&from=${await getMyId()}`;
      }
      // re-apply the highlight for the newly created (now selected) trip,
      // same as the click handler below does - loadYourTrips() re-renders
      // every card from scratch, so nothing stays highlighted otherwise
      await loadYourTrips();
      const newTripElement = document.querySelector(
        `#yourTrips [id="${data}"]`,
      );
      if (newTripElement) highlightTrip(newTripElement);
    } else {
      tripError.textContent = "Could not add the trip, please try again.";
      tripError.classList.remove("hidden");
    }

    btn.dataset.loading = "false";
    btn.innerHTML = originalLabel;
  });

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

loadYourTrips().then(() => {
  // re-apply the highlight for the restored trip once the list is actually rendered
  if (storedTripId) {
    const element = document.querySelector(`#yourTrips [id="${storedTripId}"]`);
    if (element) highlightTrip(element);
  }
});

// highlights the given trip element in the sidebar and un-highlights the rest
function highlightTrip(element) {
  // clear the style of bg of other elements if they exist
  const otherElements = [
    ...element.closest("#yourTrips").querySelectorAll(".trip"),
  ];
  otherElements.map((el) => (el.style.background = "transparent"));
  // add a bg color to selected trip
  element.style.background = "rgba(255, 255, 255, 0.16)";
}
document
  .getElementById("yourTrips")
  .addEventListener("click", async (event) => {
    const element = event.target.closest(".trip");
    if (!element) return;
    highlightTrip(element);
    localStorage.setItem("selectedTripId", element.id);

    // create a custom event and attach it globally so it can be listened on other files
    document.dispatchEvent(
      new CustomEvent("changeTrip", { detail: { tripId: element.id } }),
    );
    await getSingleTripDetails(element.id);
    await highlightTrip(element);
    getRecentActivities(element.id);
  });

// fetches the selected trip's details and renders them into #tripHeader
async function getSingleTripDetails(tripId) {
  const response = await fetch(`/singleTripDetails/${tripId}`);
  // requireTripMember 403s (plain text, not JSON) when selectedTripId in
  // localStorage is stale - the trip was deleted, or this user is no
  // longer a member - so clear it here instead of leaving it stuck
  // forever silently blocking anything that checks for a selected trip
  if (!response.ok) {
    localStorage.removeItem("selectedTripId");
    return;
  }
  const trip = await response.json();
  const container = document.getElementById("tripHeader");
  container.dataset.tripId = tripId;
  container.dataset.lat = trip.lat;
  container.dataset.lng = trip.lng;
  container.dataset.destinationName = trip.destinationName;

  const start = trip.startDate.slice(0, 10);
  container.dataset.startDate = start;
  const end = trip.endDate.slice(0, 10);
  container.dataset.endDate = end;
  const dateInfo = formatTripDates(start, end);

  container.innerHTML = "";
  let addedElement = `<h2
                class="flex flex-row items-baseline justify-between gap-2 text-base font-semibold text-white"
              >
                <span>${trip.destinationName || trip.destination}</span
                ><span class="text-sm font-normal text-white">${dateInfo.compact}</span>
              </h2>
              <!-- card containing the trip info -->
              <div class="card flex-1 bg-base-100 card-xs shadow-sm">
                <div class="card-body">
                  <div class="flex flex-row items-start justify-between gap-2">
                    <div>
                      <h2 id="destName" class="card-title">${trip.destinationName || trip.destination}</h2>
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

  // lets other scripts (e.g. calendar.js's weather widget) know tripHeader's
  // dataset (lat/lng included) is actually populated, since this function is
  // async and runs on page load before those scripts can rely on it being done
  document.dispatchEvent(new CustomEvent("tripHeaderRendered"));
}
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

// sends the actual delete request for a trip id, called only after the user confirms
async function deleteTrip(id) {
  const response = await fetch(`/deleteTrip/${id}`, { method: "DELETE" });
  if (response.ok) {
    localStorage.removeItem("selectedTripId");
    localStorage.removeItem(`aiGenerated_${id}`);
    document.dispatchEvent(
      new CustomEvent("tripDeleted", { detail: { tripId: id } }),
    );
  }
  return response;
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
  // #dest-title is a container div - the actual autocomplete widget inside
  // it has its own `.value` property (confirmed via testing; the newer
  // PlaceAutocompleteElement has no documented prefill API, but `.value`
  // both reads and writes the displayed text correctly)
  document.querySelector("#dest-title gmp-place-autocomplete").value =
    data.destination;
  // also set dataset.destination directly (not just the widget's visible
  // text) - validateTripDates (sidebar.js) reads dataset.destination on
  // submit, so without this an unchanged edit would incorrectly fail its
  // "Please Enter your destination." check
  document.getElementById("dest-title").dataset.destination = data.destination;
  document.getElementById("dest-title").dataset.destinationName =
    data.destinationName;
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

// get recently added activities from the server to show in the sidebar
async function getRecentActivities(tripId) {
  try {
    const errorMsg = document.getElementById("activityError");
    const container = document.getElementById("recentActivities");
    container.innerHTML = "";

    errorMsg.classList.add("hidden");
    const response = await fetch(`/recentActivities/${tripId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.length === 0) {
        errorMsg.className = "text-xs text-white mt-1 text-center mt-2";
        errorMsg.textContent = "No activities to show.";
        errorMsg.classList.remove("hidden");
      } else {
        data.forEach((element) => {
          const dateString = element.date.slice(0, 10);
          const date = new Date(dateString + "T00:00:00").toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" },
          );

          const html = `<div data-solo="${element.participants.length === 1 ? "true" : "false"}" data-id="${element._id}" class="activity flex flex-col gap-2 px-2">
                  <p class="text-sm font-normal text-white">${date}</p>
                  <div class="card flex-1 bg-base-100 card-xs shadow-sm">
                    <div class="card-body">
                      <div
                        class="flex flex-row items-center justify-between gap-2"
                      >
                        <h2 class="card-title text-sm">${element.activityName}</h2>
                        <div class="flex items-center gap-2 shrink-0">
                          <p class="text-sm text-base-content/60">${element.startTime}-${element.endTime}</p>
                          <button class="deleteActivity">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>`;
          container.insertAdjacentHTML("beforeend", html);
        });
      }
    } else {
      errorMsg.className = "text-sm text-red-500 mt-1 text-center mt-2";
      errorMsg.textContent = await response.text();
      errorMsg.classList.remove("hidden");
    }
  } catch (error) {
    const errorMsg = document.getElementById("activityError");
    errorMsg.className = "text-sm text-red-500 mt-1 text-center mt-2";
    errorMsg.textContent = "Could not reach the server. Try again.";
    errorMsg.classList.remove("hidden");
  }
}

// deleting an activity from sidebar
const deleteActivityModal = document.getElementById(
  "deleteActivityConfirmModal",
);

// attach a listener using delegation
const deleteScopeContainer = document.getElementById("deleteActivityScope");
document
  .getElementById("recentActivities")
  .addEventListener("click", (event) => {
    deleteScopeContainer.classList.add("hidden");

    const deleteBtn = event.target.closest(".deleteActivity");
    if (!deleteBtn) return;

    // find out if the activity is solo or grp to show the radio options by reaching to the btn's parent row and reading its dataset
    const activityRow = deleteBtn.closest(".activity");
    deleteActivityModal.dataset.activityId = activityRow.dataset.id;
    if (activityRow.dataset.solo === "false")
      deleteScopeContainer.classList.remove("hidden");

    deleteActivityModal.showModal();
  });

// delete the activity listener
const confirmDeleteActivity = document.getElementById("confirmDeleteActivity");

confirmDeleteActivity.addEventListener("click", async () => {
  const btnOriginal = confirmDeleteActivity.textContent;
  if (confirmDeleteActivity.dataset.loading === "true") return;
  const tripId = localStorage.getItem("selectedTripId");
  const activityId = deleteActivityModal.dataset.activityId;
  const deleteActivityError = document.getElementById("deleteActivityError");
  deleteActivityError.classList.add("hidden");

  confirmDeleteActivity.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;
  confirmDeleteActivity.dataset.loading = "true";

  try {
    if (!deleteScopeContainer.classList.contains("hidden")) {
      if (document.getElementById("deleteForGroup").checked) {
        const response = await fetch(`/deleteActivityGrp/${activityId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          deleteActivityModal.close();
          await getRecentActivities(tripId);
        } else {
          deleteActivityError.textContent = await response.text();
          deleteActivityError.classList.remove("hidden");
        }
      } else {
        const response = await fetch(`/deleteActivitySolo/${activityId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          deleteActivityModal.close();
          await getRecentActivities(tripId);
        } else {
          deleteActivityError.textContent = await response.text();
          deleteActivityError.classList.remove("hidden");
        }
      }
    } else {
      const response = await fetch(`/deleteActivitySolo/${activityId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        deleteActivityModal.close();
        await getRecentActivities(tripId);
      } else {
        deleteActivityError.textContent = await response.text();
        deleteActivityError.classList.remove("hidden");
      }
    }
    confirmDeleteActivity.textContent = btnOriginal;
    confirmDeleteActivity.dataset.loading = "false";
  } catch (error) {
    deleteActivityError.textContent = "Could not reach the server. Try again.";
    deleteActivityError.classList.remove("hidden");

    confirmDeleteActivity.textContent = btnOriginal;
    confirmDeleteActivity.dataset.loading = "false";
  }
});
