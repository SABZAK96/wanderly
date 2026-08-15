let tripId = localStorage.getItem("selectedTripId");
let aiGeneratedKey = `aiGenerated_${tripId}`;

const packingContainer = document.getElementById("packingContainer");
const generatedSection = document.getElementById("generated");
const notGeneratedSection = document.getElementById("notGenerated");

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
  if (localStorage.getItem(key) && tripId) {
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

// shows the trip-picker modal and bails out if no trip is selected yet (sidebar.js),
// then generates the placeholder items for every category and refreshes the display
async function generatePackingList(objOfItems) {
  if (!(await requireTripSelected())) return;
  // items1 etc. are list of objects {title:sth}

  tripId = localStorage.getItem("selectedTripId");
  aiGeneratedKey = `aiGenerated_${tripId}`;
  localStorage.setItem(aiGeneratedKey, true);

  await Promise.allSettled(
    //object.entries -> converts object into a two-dimensional array - [key, value]
    Object.entries(objOfItems).map((element) =>
      createInitialList(tripId, element[0], element[1]),
    ),
  );
  checkLocalStorage(aiGeneratedKey, tripId);
}

// start by initializing the page when user clicks on generate the packing list
document.getElementById("aiGenerate").addEventListener("click", () =>
  generatePackingList({
    "Documents & Essentials": [{ title: "passport" }, { title: "visa" }],
    "Weather Essentials": [{ title: "passport" }, { title: "visa" }],
    "Planned Activities": [{ title: "passport" }, { title: "visa" }],
    "Toiletries & Health": [{ title: "passport" }, { title: "visa" }],
  }),
);

// fetch the packing list (categories + items) for a trip from the server
async function getCurrentPackingDetails(tripId) {
  const packingError = document.getElementById("packingError");
  try {
    const response = await fetch(`/getPackingList/${tripId}`);
    if (response.ok) {
      packingError.textContent = "";
      packingError.classList.add("hidden");
      const data = await response.json();
      return data;
    } else {
      const text = await response.text();
      packingError.textContent = text;
      packingError.classList.remove("hidden");
    }
  } catch (error) {
    packingError.textContent = "Something went wrong. Please try again.";
    packingError.classList.remove("hidden");
  }
}

// insert items for each category - this function is intended to be used by AI for generating initial packing list, items is an array
async function createInitialList(tripId, category, items) {
  const packingError = document.getElementById("packingError");
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
      const text = await response.text();
      packingError.textContent = text;
      packingError.classList.remove("hidden");
    }
  } catch (error) {
    // error message
    packingError.textContent = "Something went wrong. Please try again.";
    packingError.classList.remove("hidden");
  }
}

// clear and redraw the packing list container from category/items data
function renderResulst(data) {
  packingContainer.innerHTML = "";
  let html;
  data.forEach((item) => {
    html = `<div
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
    if (item.items.length === 0) {
      html += `<p class="text-center text-base-content/60 md:text-sm text-xs">No items yet in this category.</p>
    <!-- input field for adding items -->
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
                    </div>`;
    } else {
      item.items.forEach((el) => {
        html += `<label
                      class="packing-item flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <input data-item-Id="${el._id}" type="checkbox" class="checkbox checkbox-sm" ${el.packed ? "checked" : ""} />
                      <span class="title item-label text-sm flex-1"
                        >${el.title}</span>
                        <button type="button" class="deleteItem btn btn-ghost btn-xs btn-square text-error">
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
                    <p class="listError mt-2 text-start text-error md:text-sm text-xs hidden "></p>
                  </div>
                </div>`;
    }

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

  const errorMsg = closestParent.querySelector(".listError");
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");

  const originalLabel = addBtn.textContent;
  if (addBtn.dataset.loading === "true") return;

  addBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
  addBtn.dataset.loading = "true";

  const newAddedTitle = closestParent.querySelector(".newItem").value;
  if (newAddedTitle.trim() === "") {
    // message for showing error
    errorMsg.textContent = "Please enter a name for the item.";
    errorMsg.classList.remove("hidden");
    addBtn.textContent = originalLabel;
    addBtn.dataset.loading = "false";
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
      const text = await response.text();
      errorMsg.textContent = text;
      errorMsg.classList.remove("hidden");
      return;
    }
  } catch (error) {
    errorMsg.textContent = "Something went wrong. Please try again.";
    errorMsg.classList.remove("hidden");
  } finally {
    addBtn.textContent = originalLabel;
    addBtn.dataset.loading = "false";
  }
});

// packing an element - delegation
packingContainer.addEventListener("change", async (event) => {
  const inputBtn = event.target.closest(".checkbox");
  if (!inputBtn) return;
  const closestParent = inputBtn.closest(".collapse");
  const category = closestParent.querySelector(".category").textContent;

  const errorMsg = closestParent.querySelector(".listError");
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");

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
    } else {
      const text = await response.text();
      errorMsg.textContent = text;
      errorMsg.classList.remove("hidden");
      inputBtn.checked = !inputBtn.checked; // revert the toggle since the server didn't persist it
    }
  } catch (error) {
    errorMsg.textContent = "Something went wrong. Please try again.";
    errorMsg.classList.remove("hidden");
    inputBtn.checked = !inputBtn.checked;
  }
});

// deleting an item from the packing list
packingContainer.addEventListener("click", async (event) => {
  const delBtn = event.target.closest(".deleteItem");
  if (!delBtn) return;
  event.preventDefault(); // stop the label from also toggling its checkbox (strike-through)
  const parentItem = delBtn.closest(".collapse");

  const errorMsg = parentItem.querySelector(".listError");
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");

  const originalIcon = delBtn.innerHTML;
  if (delBtn.dataset.loading === "true") return;

  delBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
  delBtn.dataset.loading = "true";

  const category = parentItem.querySelector(".category").textContent;
  const itemId = delBtn.closest(".packing-item").querySelector(".checkbox")
    .dataset.itemId;

  try {
    const response = await fetch(`/deleteItem/${tripId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ category: category, itemId: itemId }),
    });
    if (response.ok) {
      getCurrentPackingDetails(tripId).then((data) => renderResulst(data));
    } else {
      const text = await response.text();
      errorMsg.textContent = text;
      errorMsg.classList.remove("hidden");
      return;
    }
  } catch (error) {
    errorMsg.textContent = "Something went wrong. Please try again.";
    errorMsg.classList.remove("hidden");
  } finally {
    delBtn.innerHTML = originalIcon;
    delBtn.dataset.loading = "false";
  }
});

// add a new category listener
const addCategoryModal = document.getElementById("addCategoryModal");
const categoryNameInput = document.getElementById("newCategoryName");
const categoryNewError = document.getElementById("addCategoryError");

document.getElementById("addCategory").addEventListener("click", () => {
  // clean up the modal and pop it up
  categoryNameInput.value = "";
  categoryNewError.textContent = "";
  categoryNewError.classList.add("hidden");
  addCategoryModal.showModal();
});

const confirmBtn = document.getElementById("confirmAddCategory");
confirmBtn.addEventListener("click", async () => {
  const originalLabel = confirmBtn.textContent;
  if (confirmBtn.dataset.loading === "true") return;

  confirmBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
  confirmBtn.dataset.loading = "true";

  const trimmedName = categoryNameInput.value.trim();

  if (trimmedName === "") {
    categoryNewError.textContent = "Please enter a category.";
    categoryNewError.classList.remove("hidden");

    confirmBtn.textContent = originalLabel;
    confirmBtn.dataset.loading = "false";

    return;
  }

  try {
    const response = await fetch(`/addcategory/${tripId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1),
      }),
    });
    if (response.ok) {
      addCategoryModal.close();
      getCurrentPackingDetails(tripId).then((data) => renderResulst(data));
    } else {
      const text = await response.text();
      categoryNewError.textContent = text;
      categoryNewError.classList.remove("hidden");
      return;
    }
  } catch (error) {
    categoryNewError.textContent = "Something went wrong. Please try again.";
    categoryNewError.classList.remove("hidden");
  } finally {
    confirmBtn.textContent = originalLabel;
    confirmBtn.dataset.loading = "false";
  }
});
