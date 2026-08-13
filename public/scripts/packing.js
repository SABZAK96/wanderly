let tripId = localStorage.getItem("selectedTripId");
let aiGeneratedKey = `aiGenerated_${tripId}`;

const packingContainer = document.getElementById("packingContainer");
const generatedSection = document.getElementById("generated");
const notGeneratedSection = document.getElementById("notGenerated");

const categories = [
  "Documents & Essentials",
  "Weather Essentials",
  "Planned Activities",
  "Toiletries & Health",
];

// keep #destName/#date in sync with the selected trip's header info -
// tripHeaderRendered only fires once sidebar.js has actually populated
// #tripHeader's dataset (it's async), so this covers both the initial
// load and every later trip switch, instead of reading it too early
document.addEventListener("tripHeaderRendered", () => {
  const header = document.getElementById("tripHeader");
  document.getElementById("destName").textContent =
    header.dataset.destinationName;
  document.getElementById("date").textContent = formatTripDates(
    header.dataset.startDate,
    header.dataset.endDate,
  ).compact;
});

function checkLocalStorage(key, tripId) {
  if (localStorage.getItem(key)) {
    generatedSection.classList.remove("hidden");
    notGeneratedSection.classList.add("hidden");
    getCurrentPackingDetails(tripId).then((data) => renderResulst(data));
  } else {
    generatedSection.classList.add("hidden");
    notGeneratedSection.classList.remove("hidden");
  }
}
// restore the generated/not-generated state for the trip selected on page load
checkLocalStorage(aiGeneratedKey, tripId);

// re-sync tripId, aiGeneratedKey, and the visible section when the sidebar switches trips
document.addEventListener("changeTrip", (e) => {
  tripId = e.detail.tripId;
  aiGeneratedKey = `aiGenerated_${e.detail.tripId}`;
  checkLocalStorage(aiGeneratedKey, tripId);
});

document.addEventListener("tripDeleted", () => {
  tripId = null;
  aiGeneratedKey = `aiGenerated_${tripId}`;
  checkLocalStorage(aiGeneratedKey, tripId);
});

document.addEventListener("tripAdded", (e) => {
  tripId = e.detail.tripId;
  aiGeneratedKey = `aiGenerated_${tripId}`;
  checkLocalStorage(aiGeneratedKey, tripId);
});

// start by initializing the page when user clicks on generate the packing list
document.getElementById("aiGenerate").addEventListener("click", async () => {
  localStorage.setItem(aiGeneratedKey, true);
  await Promise.allSettled(
    categories.map((category) =>
      createInitialList(tripId, category, [
        { title: "passport" },
        { title: "visa" },
      ]),
    ),
  );
  generatedSection.classList.remove("hidden");
  notGeneratedSection.classList.add("hidden");
  getCurrentPackingDetails(tripId).then((data) => renderResulst(data));
});

// fetch the packing list (categories + items) for a trip from the server
async function getCurrentPackingDetails(tripId) {
  try {
    const response = await fetch(`/getPackingList/${tripId}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
    }
  } catch (error) {}
}

// insert items for each category - this function is intended to be used by AI for generating initial packing list, items is an array
async function createInitialList(tripId, category, items) {
  try {
    const response = await fetch(`/generatePackingListAI/${tripId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ category: category, items: items }),
    });
    // call get current packing details to get the most recent details for each category
    if (response.ok) {
    } else {
      // error message
    }
  } catch (error) {
    // error message
  }
}

// clear and redraw the packing list container from category/items data
function renderResulst(data) {
  packingContainer.innerHTML = "";
  data.forEach((item) => {
    let html = `<div
                  tabindex="0"
                  class="collapse collapse-open collapse-arrow bg-base-100 border-base-300 border"
                >
                  <div
                    class="collapse-title flex flex-row justify-between font-semibold"
                    style="color: #534ab7"
                  >
                    <span class="category">${item.category}</span>
                    <div class="flex flex-row items-center text-xs"><span class="count"></span>/<span class="total"></span></div>
                  </div>
                  <div class="collapse-content text-sm">
                    <!-- input fields containing the items -->
                  `;
    item.items.forEach((el) => {
      html += `<label
                      class="packing-item flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <input data-item-Id="${el._id}" type="checkbox" class="checkbox checkbox-sm" ${el.packed ? "checked" : ""} />
                      <span class="title item-label text-sm flex-1"
                        >${el.title}</span>
                    </label>`;
    });
    html += `<!-- input field for adding items -->
                    <div class="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Add an item..."
                        class="newItem input input-sm w-full"
                      />
                      <button
                        class="addSingle btn btn-sm btn-ghost"
                        style="color: #534ab7"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>`;
    packingContainer.insertAdjacentHTML("beforeend", html);

    // calculating checked items and total items after rendering each part
    const newEl = packingContainer.lastElementChild;
    const totalInputs = [...newEl.querySelectorAll(".checkbox")];
    const checkedInputs = totalInputs.filter((element) => element.checked);
    newEl.querySelector(".count").textContent = checkedInputs.length;
    newEl.querySelector(".total").textContent = totalInputs.length;
  });
  updateProgressBar();
}

// update the progress bar with selecting and de-selecting elements
function updateProgressBar() {
  const bar = document.getElementById("progBar");
  const barMax = [...packingContainer.querySelectorAll(".collapse .checkbox")]
    .length;
  console.log(barMax);
  const barValue = [...packingContainer.querySelectorAll(".checkbox")].filter(
    (element) => element.checked,
  ).length;
  console.log(barValue);
  bar.max = barMax;
  bar.value = barValue;
  document.getElementById("totalItems").textContent = barMax;
  document.getElementById("packed").textContent = barValue;
}

// add individual items to each section - using delegation
packingContainer.addEventListener("click", async (event) => {
  const addBtn = event.target.closest(".addSingle");
  if (!addBtn) return;
  const closestParent = addBtn.closest(".collapse");
  const newAddedTitle = closestParent.querySelector(".newItem").value;
  if (newAddedTitle.trim() === "") {
    // message
    return;
  }
  const category = closestParent.querySelector(".category").textContent;
  try {
    const response = await fetch(`/addToPackingList/${tripId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: category,
        item: { title: newAddedTitle },
      }),
    });
    if (response.ok) {
      getCurrentPackingDetails(tripId).then((data) => renderResulst(data));
    } else {
      // error
      return;
    }
  } catch (error) {}
});

// packing an element - delegation
packingContainer.addEventListener("change", async (event) => {
  const inputBtn = event.target.closest(".checkbox");
  if (!inputBtn) return;
  const closestParent = inputBtn.closest(".collapse");
  const category = closestParent.querySelector(".category").textContent;

  try {
    const response = await fetch(`/updatePackingList/${tripId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: category,
        itemId: inputBtn.dataset.itemId,
        isPacked: inputBtn.checked ? "true" : "false",
      }),
    });
    if (response.ok) {
      getCurrentPackingDetails(tripId).then((data) => renderResulst(data));
    }
  } catch (error) {}
});
