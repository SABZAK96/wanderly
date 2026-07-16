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
