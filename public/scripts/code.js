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
async function initAutocomplete() {
  // libraries=places in the script tag's URL already loaded the library,
  // but it only exposes the class namespaced under google.maps.places -
  // there's no bare global called PlaceAutocompleteElement on its own
  // so const { PlaceAutocompleteElement } =
  // await google.maps.importLibrary('places'); will be changed to the following lines
  const { PlaceAutocompleteElement } = google.maps.places;

  // Create the input HTML element, and append it.
  const placeAutocomplete = new PlaceAutocompleteElement();
  document.getElementById("dest-title").appendChild(placeAutocomplete);

  // tracks the exact text of the last real selection, so the "input"
  // listener below can tell "the user edited after selecting" apart from
  // "this input event was fired by the selection itself" without relying
  // on which of the two events happens to fire first internally
  let lastConfirmedValue = "";

  // Add the gmp-select listener
  placeAutocomplete.addEventListener(
    "gmp-select",
    async ({ placePrediction }) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });
      lastConfirmedValue = place.formattedAddress;
      document.getElementById("dest-title").dataset.destination =
        place.formattedAddress;
    },
  );

  // typing after a selection means that selection is no longer valid -
  // clear dataset.destination so the existing "Please Enter your
  // destination." check in validateTripDates (sidebar.js) blocks
  // submitting an unselected/garbage destination, instead of silently
  // reusing whatever place was selected before the user started editing.
  // Compares against lastConfirmedValue rather than unconditionally
  // clearing, since selecting a suggestion may itself fire "input" -
  // only clear when the visible text has actually diverged from the last
  // real selection
  placeAutocomplete.addEventListener("input", () => {
    if (placeAutocomplete.value !== lastConfirmedValue) {
      document.getElementById("dest-title").dataset.destination = "";
    }
  });
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
  document.getElementById("dest-title").dataset.destination =
    data.destination;
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
