// string badges and update them when they are build to update the table tags easily
let peopleBadges = undefined;

document.getElementById("addExp").addEventListener("click", () => {
  document.getElementById("my_modal_expense").showModal();

  // clearing up the fields in the modal whenever add expense is clicked
  const titleInput = document.getElementById("exp-title");
  const costInput = document.getElementById("exp-cost");

  titleInput.value = "";
  costInput.value = "";

  //clearing paidBy section highlights
  const Allbadges = document.querySelectorAll("#exp-payer span");
  Allbadges.forEach((badge) => {
    badge.classList.contains("border-2") && badge.classList.remove("border-2");
  });
  const coPayerContainer = document.getElementById("coPayerAmount");
  coPayerContainer.innerHTML = "";
  coPayerContainer.classList.add("hidden");

  //clearing who owes who highlights
  const customAmountContainer = document.getElementById("customAmount");
  customAmountContainer.innerHTML = "";
  customAmountContainer.classList.add("hidden");

  const debtBadges = document.querySelectorAll("#debt-payer span");
  debtBadges.forEach((badge) => {
    badge.classList.contains("border-2") && badge.classList.remove("border-2");
  });

  // re-select the "All" badge as the default, without re-attaching listeners via initAllBadge
  document.getElementById("allBadge").classList.add("border-2");

  // setting the radio button to equally
  document.getElementById("equalRadio").checked = true;
});

// fetch all the badges from the db
async function getPeople() {
  const response = await (
    await fetch("/people/6a445ee01781d2a29c611442")
  ).json();
  return response;
}

// load the modal with the badges recieved from the db
async function populateFieldsBadges(id) {
  const response = await getPeople();
  const container = document.getElementById(id);
  response.forEach((person) => {
    const badgeSpan = `<span
                class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium person-pill cursor-pointer payer-option border-0 border-[${person.badgeInfo.border}]"
                data-name="${person.name}"
                data-id="${person._id}"
                style="background: ${person.badgeInfo.bg}; color: ${person.badgeInfo.color}"
                >${person.name}</span>`;
    container.insertAdjacentHTML("beforeend", badgeSpan);
  });
  peopleBadges = [...container.querySelectorAll(".person-pill")];
}

//funtion that set up the modal using the info of people retrieved from the db
async function setUpModal() {
  await Promise.all([
    populateFieldsBadges("debt-payer"),
    populateFieldsBadges("exp-payer"),
  ]);
  highlightBadges("debt-payer");
  highlightBadges("exp-payer");
  initAllBadge("debt-payer");
  await initTable();
}

function setUpPage() {
  return renderDebtBreakdown().then(async () => {
    initSettleToggles();
    const results = await calculateSpending();
    renderSpending(results);
  });
}

// hide the page-level loading overlay once the initial data load finishes,
// whether it succeeded or failed - a stuck spinner is worse than a broken page
// .finally ensures that a specific block of code runs after a process completes, regardless of whether it succeeded or failed
Promise.all([setUpModal(), setUpPage()]).finally(() => {
  document.getElementById("pageLoading").classList.add("hidden");
});

// pre-select All badge in the who owes the payer section
function initAllBadge(id) {
  const allBadge = document.getElementById("allBadge");
  const container = document.getElementById(id);
  const nameBadges = [...container.querySelectorAll(".person-pill")].filter(
    (badge) => badge !== allBadge,
  );
  allBadge.classList.add("border-2");
  nameBadges.forEach((nameBadge) => {
    nameBadge.addEventListener("click", () => {
      allBadge.classList.remove("border-2");

      //re-select allBadge if nothing else is selected
      if (
        nameBadges.every(
          (nameBadge) => !nameBadge.classList.contains("border-2"),
        )
      ) {
        allBadge.classList.add("border-2");
      }
      if (customRadio.checked) popBadgesInCustom();
    });
  });

  //if allBadge is clicked again, de-select other badges
  allBadge.addEventListener("click", () => {
    !allBadge.classList.contains("border-2") &&
      allBadge.classList.add("border-2");
    nameBadges.forEach(
      (badge) =>
        badge.classList.contains("border-2") &&
        badge.classList.remove("border-2"),
    );
    if (customRadio.checked) popBadgesInCustom();
  });
}

// make all the borders bold when clicked
function highlightBadges(id) {
  const allNameBadges = document.querySelectorAll(`#${id} .person-pill`);
  allNameBadges.forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.contains("border-2")
        ? btn.classList.remove("border-2")
        : btn.classList.add("border-2");
      if (id === "debt-payer" && customRadio.checked) popBadgesInCustom();

      //logic for having co-payers
      if (id === "exp-payer") {
        const coPayerContainer = document.getElementById("coPayerAmount");
        const paidByArray = [
          ...document
            .getElementById("exp-payer")
            .querySelectorAll(".person-pill"),
        ].filter((element) => element.classList.contains("border-2"));
        coPayerContainer.innerHTML = "";
        if (paidByArray.length >= 2) {
          coPayerContainer.classList.remove("hidden");
          populateRows(paidByArray, "coPayerAmount");
        } else {
          coPayerContainer.classList.add("hidden");
        }
      }
    });
  });
}

// popping custom field when the radio button is checked
const radioGroup = document.querySelectorAll("input[name='radio-2']");
const customInputField = document.getElementById("customAmount");
const customRadio = document.getElementById("customRadio");
radioGroup.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (customRadio.checked) {
      customInputField.classList.remove("hidden");

      // run here, after the user has made selections
      popBadgesInCustom();
    } else {
      customInputField.classList.add("hidden");
    }
  });
});

// adding selected badges below custom field based on the selected badge
function popBadgesInCustom() {
  const container = document.getElementById("debt-payer");
  const customAmountContainer = document.getElementById("customAmount");
  let containerArray = [...container.querySelectorAll(".person-pill")];
  customAmountContainer.innerHTML = "";

  containerArray = containerArray.filter((element) =>
    element.classList.contains("border-2"),
  );
  //logic for allBadge
  if (containerArray.find((element) => element.id === "allBadge")) {
    const allNames = [...container.querySelectorAll(".person-pill")].filter(
      (badge) => badge.id !== "allBadge",
    );
    populateRows(allNames, "customAmount");
  }
  // logic for selecting nameBadges
  else {
    populateRows(containerArray, "customAmount");
  }
}

//function for adding rows to custom amount field
function populateRows(myArray, id) {
  const customAmountContainer = document.getElementById(id);
  myArray.forEach((element) => {
    const row = document.createElement("div");
    row.className = "flex flex-row items-center justify-between customInputRow";

    const badgeClone = element.cloneNode(true);
    badgeClone.classList.remove("border-2");

    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = "Amount";
    input.className = "input input-xs max-w-[100px] max-h-15 customInput";
    input.dataset.name = element.dataset.name;
    input.dataset.id = element.dataset.id;

    row.appendChild(badgeClone);
    row.appendChild(input);
    customAmountContainer.appendChild(row);
  });
}
// popping up/hiding the Mark as settled button as checkboxes are (un)checked -
// needs to run after the debt breakdown cards exist in the DOM, so it's called
// once renderDebtBreakdown() has finished inserting them, not at script load
function initSettleToggles() {
  const settleInputs = document.querySelectorAll(
    ".collapse-content input[type='checkbox']",
  );

  settleInputs.forEach((field) => {
    field.addEventListener("change", () => {
      //scoping to the currnt accordion only - get the parent of the field we are working through and put all the input fields under that parent in an array
      const allInputsAsArray = [
        ...field
          .closest(".collapse-content")
          .querySelectorAll("input[type='checkbox']"),
      ];
      if (field.checked) {
        field
          .closest(".collapse-content")
          .lastElementChild.classList.remove("hidden");
      }

      const allUnChecked = allInputsAsArray.every(
        (element) => element.checked === false,
      );

      // popping out Mark as settled button when all inputs are unchecked
      if (allUnChecked) {
        field
          .closest(".collapse-content")
          .lastElementChild.classList.add("hidden");
      }
    });
  });
}

//================================================================================================
// add/remove an expense logic in modal
//================================================================================================

// first update the table with added row
document
  .getElementById("exp-submit")
  .addEventListener("click", async (event) => {
    const submitBtn = event.currentTarget;
    if (submitBtn.dataset.loading === "true") return; // guard against double-click
    const titleInput = document.getElementById("exp-title");
    const costInput = document.getElementById("exp-cost");
    let expenseTitle = titleInput.value;
    let costAmount = costInput.value;
    const Allbadges = document.querySelectorAll("#exp-payer span");
    const errorMsg = document.getElementById("errorMsg");

    let selectedBadgesPayers = [...Allbadges];
    //save the result of the filter back to the variable - otherwise it will be thorwn away
    selectedBadgesPayers = selectedBadgesPayers.filter((badge) =>
      badge.classList.contains("border-2"),
    );

    const allBadgesDebts = document.querySelectorAll("#debt-payer span");
    let selectedBadgesDebts = [...allBadgesDebts];
    selectedBadgesDebts = selectedBadgesDebts.filter((badge) =>
      badge.classList.contains("border-2"),
    );

    //validate the fields are filled
    if (titleInput.value.trim() === "") {
      titleInput.classList.add("border-2", "border-red-500");
      return;
    }
    titleInput.classList.contains("border-red-500") &&
      titleInput.classList.remove("border-2", "border-red-500");

    if (costInput.value === "" || costInput.value === "0") {
      costInput.classList.add("border-2", "border-red-500");
      return;
    }
    costInput.classList.contains("border-red-500") &&
      costInput.classList.remove("border-2", "border-red-500");
    if (selectedBadgesPayers.length === 0) {
      errorMsg.classList.remove("hidden");
      errorMsg.textContent = "* Please Select the Payers!";
      return;
    }
    errorMsg.textContent = "";
    errorMsg.classList.add("hidden");

    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.dataset.loading = "true";
    submitBtn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    try {
      const owes = await calculateSplitAmounts(costAmount, selectedBadgesDebts);
      const { paidBy, owed } = calculateOwedAmount(
        owes,
        selectedBadgesPayers,
        costAmount,
      );

      if (!expenseInputValidator(costAmount, owes, owed)) {
        errorMsg.classList.remove("hidden");
        errorMsg.textContent = "* Split amounts must add up to the total cost!";
        return;
      }
      const response = await sendExpenseToDB(
        expenseTitle,
        costAmount,
        paidBy,
        owes,
      );
      if (!response.ok) {
        errorMsg.classList.remove("hidden");
        errorMsg.textContent = "* Failed to save expense. Please try again.";
        return;
      }
      const serverResponse = await response.json();

      //cleaning the values to have a good look in the UI
      expenseTitle = expenseTitle.trim();
      expenseTitle =
        expenseTitle.charAt(0).toUpperCase() + expenseTitle.slice(1);
      costAmount = Number(costAmount).toLocaleString("en-US");

      updateTable(
        selectedBadgesPayers,
        expenseTitle,
        costAmount,
        serverResponse._id,
      );

      document.getElementById("my_modal_expense").close();
    } finally {
      submitBtn.dataset.loading = "false";
      submitBtn.innerHTML = originalBtnContent;
    }
  });

// init table
async function initTable() {
  //response would be an array of expenses

  const response = await (
    await fetch("/getExpenses/6a445ee01781d2a29c611442")
  ).json();

  response.forEach((expense) => {
    //preparing badges
    const selectedBadges = expense.paidBy.map((item) =>
      peopleBadges.find((badge) => badge.dataset.id === item.person),
    );

    //preparing expense title
    const expTitle = expense.title.trim();
    const expTitlePrepped =
      expTitle.charAt(0).toUpperCase() + expTitle.slice(1);

    //preparing total cost
    const cost = expense.amount;
    const costPrepped = Number(cost).toLocaleString("en-US");

    updateTable(selectedBadges, expTitlePrepped, costPrepped, expense._id);
  });
}
// update the table with adding a new row

function updateTable(selectedBadges, expenseTitle, costAmount, expenseId) {
  const tableBody = document.querySelector("#my_table tbody");
  let newTableRow = "";
  newTableRow = `  <tr data-id="${expenseId}">
    <td class="font-medium " contenteditable="true">${expenseTitle}</td>
    <td contenteditable="true"><span>$</span><span class="tableAmounts">${costAmount}</span></td>
    <td><div class="flex flex-wrap gap-1 badgePlaceHolder"></div></td>
    <td > <button
                      class="btn btn-ghost btn-xs text-error remove"
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
                    </button></td>
  </tr>`;

  tableBody.insertAdjacentHTML("beforeend", newTableRow);

  //pick the lastly added element with class badgePlaceHolder - .at(-1) gets the last element in the array
  const badgePlaceholder = [
    ...tableBody.querySelectorAll(".badgePlaceHolder"),
  ].at(-1);

  // cloneNode(true) so original badges stay in the modal for next time
  selectedBadges.forEach((badge) => {
    const badgeClone = badge.cloneNode(true);
    badgeClone.classList.remove("border-2");
    badgePlaceholder.appendChild(badgeClone);
  });

  // update the total amount in the table
  // first get the Node list using spread operator then converts in inner text to number after replacing "," with empty string
  const amounts = [...document.querySelectorAll(".tableAmounts")].map(
    (element) => Number(element.textContent.replace(",", "")),
  );
  let sum = 0;
  for (const number of amounts) {
    sum += number;
  }
  document.getElementById("total").innerHTML = sum.toLocaleString("en-US");
}

// validating fields in the add expense modal
function expenseInputValidator(cost, owes, owed) {
  let sumOfOwes = 0;
  for (const item of owes) {
    const amount = Number(item.amount);
    if (item.amount === "" || Number.isNaN(amount)) return false;
    sumOfOwes += amount;
  }

  // we should do a tolerance check because of the roundings we do in the owes calculation
  if (Math.abs(Number(cost) - sumOfOwes) >= 0.01) return false;

  // the amounts entered in owed should make sense with the total cost as well
  for (const item of owed) {
    if (item.amount === "" || Number.isNaN(Number(item.amount))) return false;
  }

  let filteredOwes = owed.map((item) => {
    const newOwes =
      owes.find((debt) => debt.person === item.person)?.amount ?? 0;
    return Number(item.amount) + Number(newOwes);
  });

  let owedSum = 0;
  for (const item of filteredOwes) {
    owedSum += item;
  }

  // we should do a tolerance check because of the roundings we do in the owes calculation
  return Math.abs(Number(cost) - owedSum) < 0.01;
}

// removing a row from db
document
  .querySelector("#my_table tbody")
  .addEventListener("click", async (event) => {
    const btn = event.target.closest(".remove");
    if (!btn) return; // click wasn't on (or inside) a delete button
    if (btn.dataset.loading === "true") return; // guard against double-click

    const row = btn.closest("tr");
    const id = row.dataset.id;
    const originalIcon = btn.innerHTML;
    btn.dataset.loading = "true";
    btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    const deleteError = document.getElementById("deleteError");
    deleteError.classList.add("hidden");

    const response = await fetch(
      `/deleteExpense/6a445ee01781d2a29c611442/${id}`,
      {
        method: "DELETE",
      },
    );

    if (response.ok) {
      row.remove(); // only remove from the page once the server confirms it's gone
      setUpPage().then(refreshFilterCard);
    } else {
      btn.dataset.loading = "false";
      btn.innerHTML = originalIcon;
      deleteError.textContent = "Failed to delete expense. Please try again.";
      deleteError.classList.remove("hidden");
    }
  });

// send the added expense to the db
async function sendExpenseToDB(title, cost, paidBy, owes) {
  const data = await fetch("/newExpense/6a445ee01781d2a29c611442", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title,
      amount: cost,
      paidBy: paidBy,
      owedBy: owes,
    }),
  });
  if (data.ok) setUpPage().then(refreshFilterCard);
  return data;
}

// calculate how much each person owes for this expense
async function calculateSplitAmounts(cost, selectedBadgesDebts) {
  //get the total number of persons in a trip with same id
  const people = await getPeople();
  const numberOfPeople = people.length;
  let splitAmounts = [];

  // if custom radio is checked
  if (document.getElementById("customRadio").checked) {
    const customSplitRows = [
      ...document.querySelectorAll("#customAmount .customInputRow"),
    ];
    customSplitRows.map((row) => {
      const nameBadge = row.children[0];
      const amountInput = row.children[1];

      let person = nameBadge.dataset.id;
      let amount = amountInput.value;
      splitAmounts.push({ person: person, amount: amount });
      console.log(splitAmounts);
    });

    // if shared equally
  } else {
    if (
      selectedBadgesDebts.length === 1 &&
      selectedBadgesDebts[0].dataset.name === "All"
    ) {
      const sharedAmount = (cost / numberOfPeople).toFixed(2);
      people.map((person) => {
        splitAmounts.push({ person: person._id, amount: sharedAmount });
        console.log(splitAmounts);
      });
    } else {
      const numberOfBadges = selectedBadgesDebts.length;
      const costPerPerson = cost / numberOfBadges;
      selectedBadgesDebts.map((element) => {
        splitAmounts.push({
          person: element.dataset.id,
          amount: costPerPerson,
        });
        console.log(splitAmounts);
      });
    }
  }
  return splitAmounts;
}

// calculate raw paid amounts (what each payer actually contributed) and
// owed amounts (net amount currently owed back to each payer)
function calculateOwedAmount(owes, selectedBadgesPayers, costAmount) {
  let owed = [];
  let paidBy = [];

  if (selectedBadgesPayers.length === 1) {
    const name = selectedBadgesPayers[0].dataset.id;
    const ownShare = Number(
      owes.find((item) => item.person === name)?.amount ?? 0,
    );
    const paidAmount = Number(costAmount);
    const amount = paidAmount - ownShare;

    paidBy.push({ person: name, amount: paidAmount });
    owed.push({ person: name, amount: amount });
  } else {
    const paidByDivs = [
      ...document.querySelectorAll("#coPayerAmount .customInputRow"),
    ];
    paidByDivs.forEach((row) => {
      const name = row.children[0].dataset.id;
      const paidAmount = Number(row.children[1].value);
      const ownShare = Number(
        owes.find((item) => item.person === name)?.amount ?? 0,
      );
      paidBy.push({ person: name, amount: paidAmount });
      owed.push({ person: name, amount: paidAmount - ownShare });
    });
  }
  console.log(paidBy, owed);
  return { paidBy, owed };
}

// --- Debt Breakdown pipeline -----------------------------------------
// per-expense who-owes-whom, handling single- and
// multi-payer (co-payer) cases via net paid-vs-owed classification
function computeExpenseDebts(expense) {
  let debts = [];
  // branch for no co-payers
  if (expense.paidBy.length === 1) {
    expense.owedBy.map((element) => {
      if (element.person !== expense.paidBy[0].person) {
        debts.push({
          expenseId: expense._id,
          to: expense.paidBy[0].person,
          from: element.person,
          amount: Number(element.amount),
        });
      }
    });
  }

  // branch for having co-payers
  else {
    let debtors = [];
    let creditors = [];

    expense.paidBy.forEach((payer) => {
      // how much of the cost was this payer's own share
      let ownShare =
        expense.owedBy.find((element) => element.person === payer.person)
          ?.amount ?? 0;
      // net position for this expense: positive = overpaid, negative = underpaid
      let isOwed = payer.amount - ownShare;

      if (isOwed > 0) {
        // overpaid their share -> owed money back
        creditors.push({ person: payer.person, amount: isOwed });
      } else if (isOwed < 0) {
        // paid less than their share -> still owes the difference
        debtors.push({ person: payer.person, amount: -isOwed });
      }
      // isOwed === 0 -> already settled for this expense, goes in neither list
    });

    // ids of everyone who contributed money to this expense
    const payerIds = expense.paidBy.map((payer) => payer.person);
    // people who owe a share but never paid anything toward this expense
    const nonPayerDebtors = expense.owedBy
      .filter((element) => !payerIds.includes(element.person))
      .map((element) => ({
        person: element.person,
        amount: Number(element.amount),
      }));
    debtors.push(...nonPayerDebtors);

    //calculate how the debt should be settled for each expense

    //counter for debtors
    let i = 0;

    //counter for creditors
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtAmount = Number(debtors[i].amount);
      const creditAmount = Number(creditors[j].amount);

      if (debtAmount < creditAmount) {
        // debtor fully paid off, creditor has leftover
        debts.push({
          expenseId: expense._id,
          to: creditors[j].person,
          from: debtors[i].person,
          amount: debtAmount,
        });
        creditors[j].amount = creditAmount - debtAmount;
        i++;
      } else if (debtAmount > creditAmount) {
        // creditor fully paid off, debtor has leftover
        debts.push({
          expenseId: expense._id,
          to: creditors[j].person,
          from: debtors[i].person,
          amount: creditAmount,
        });
        debtors[i].amount = debtAmount - creditAmount;
        j++;
      } else {
        // exact match, both fully settled
        debts.push({
          expenseId: expense._id,
          to: creditors[j].person,
          from: debtors[i].person,
          amount: debtAmount,
        });
        i++;
        j++;
      }
    }
  }
  return debts;
}

// collapses one person's repeated debt entries (across expenses) into a single running total per debtor
function mergeDebts(element, debts) {
  let summary = [];
  const newDebts = debts.filter((individual) => individual.to === element._id);
  if (newDebts.length > 0) {
    newDebts.forEach((item) => {
      let shouldPay = item.amount;

      // match on both fields - "from" alone could merge this debtor's debts to different creditors
      const debtorExist = summary.find(
        (element) => element.to === item.to && element.from === item.from,
      );
      if (debtorExist) {
        shouldPay = debtorExist.amount + item.amount;
        debtorExist.amount = shouldPay;
      } else {
        summary.push({
          to: element._id,
          from: item.from,
          amount: shouldPay,
        });
      }
    });
  }
  return summary;
}

// Nets out opposite debts between the same two people and returns the simplified list of debts
function netOppositeDebts(summary) {
  let nettedResult = [];

  let referencedSummary = [...summary];

  // store the indices of the matched and netted elements in these arrays to avoid in the next iterations
  let avoidIndexI = [];
  let avoidIndexJ = [];

  for (let i = 0; i < summary.length; i++) {
    for (let j = 0; j < referencedSummary.length; j++) {
      if (!avoidIndexI.includes(j) && !avoidIndexJ.includes(i)) {
        if (
          summary[i].to === referencedSummary[j].from &&
          summary[i].from === referencedSummary[j].to
        ) {
          avoidIndexI.push(i, j);
          avoidIndexJ.push(i, j);

          // Check if this pair of people already exists in the result,
          // regardless of who currently owes whom.
          const ItemFound = nettedResult.find(
            (item) =>
              (item.to === summary[i].to && item.from === summary[i].from) ||
              (item.to === summary[i].from && item.from === summary[i].to),
          );

          if (summary[i].amount > referencedSummary[j].amount) {
            // update the object already exists in the nettedResult
            if (ItemFound) {
              ItemFound.to = summary[i].to;
              ItemFound.from = summary[i].from;
              ItemFound.amount =
                summary[i].amount - referencedSummary[j].amount;
            } else {
              // create a new obj in nettedResult

              nettedResult.push({
                to: summary[i].to,
                from: summary[i].from,
                amount: summary[i].amount - referencedSummary[j].amount,
              });
            }
          } else if (summary[i].amount < referencedSummary[j].amount) {
            if (ItemFound) {
              ItemFound.to = referencedSummary[j].to;
              ItemFound.from = referencedSummary[j].from;
              ItemFound.amount =
                referencedSummary[j].amount - summary[i].amount;
            } else {
              nettedResult.push({
                to: referencedSummary[j].to,
                from: referencedSummary[j].from,
                amount: referencedSummary[j].amount - summary[i].amount,
              });
            }
          }
          // equal amounts -> fully cancels out; remove any stale entry
          // this pair may have pushed earlier (e.g. via self-comparison)
          else if (ItemFound) {
            nettedResult.splice(nettedResult.indexOf(ItemFound), 1);
          }
        } else {
          // stops the same entry (a fixed i) from being pushed multiple times across the inner j loop.
          const ItemFound = nettedResult.find(
            (item) =>
              item.to === summary[i].to && item.from === summary[i].from,
          );
          if (ItemFound) continue;
          else {
            nettedResult.push({
              to: summary[i].to,
              from: summary[i].from,
              amount: summary[i].amount,
            });
          }
        }
      }
      // Skip pairs that have already been processed
      else continue;
    }
  }
  return nettedResult;
}

// orchestrates the above over all expenses/people
async function computeDebtBreakdown() {
  // response is an array of expenses, people is an array containing person ids -
  // fetched concurrently since neither depends on the other
  const [response, people] = await Promise.all([
    fetch("/getExpenses/6a445ee01781d2a29c611442").then((res) => res.json()),
    getPeople(),
  ]);

  // find how much each person is owed and who owes to them, if any
  // map should be used instead of forEach so that the return value of ythe functions wont be thrown away
  // .flat() needed because each computeExpenseDebts call returns its own array - without it debts would be an array of arrays, not a flat list
  const debts = response.map((expense) => computeExpenseDebts(expense)).flat();

  // accumulating the results in debts array
  // .flat() needed for the same reason - each mergeDebts call returns its own array, one per person
  const summary = people.map((element) => mergeDebts(element, debts)).flat();

  const nettedResult = netOppositeDebts(summary);

  return nettedResult;
}

async function markAsSettled(debtorId, creditorId) {
  const response = await (
    await fetch("/getExpenses/6a445ee01781d2a29c611442")
  ).json();
  // lets say soroush settled all his debts to sina
  // an array of objects like [{ expenseId: "hotel123", to: "sinaId", from: "soroushId", amount: 70 },
  // { expenseId: "hotel123", to: "hassanId", from: "soroushId", amount: 30 }, { expenseId: "car452", to: "sinaId", from: "soroushId", amount: 30 }]
  const rawDebts = response
    .map((expense) => computeExpenseDebts(expense))
    .flat();

  // filter raw debts for the selected pair - in EITHER direction, since the
  // amount shown on screen may already be netted between the two of them
  // (e.g. soroush owes sina $400 but sina also owes soroush $100, netted
  // down to "soroush owes sina $300" for display)
  // result would be something like [{ expenseId: "hotel123", to: "sinaId", from: "soroushId", amount: 70 }, { expenseId: "car452", to: "sinaId", from: "soroushId", amount: 30 }]
  const filteredDebt = rawDebts.filter(
    (debt) =>
      (debt.to === creditorId && debt.from === debtorId) ||
      (debt.to === debtorId && debt.from === creditorId),
  );

  // if there's no unsettled debt for that expense in the rawDebts array , send the id to the db to remove soroush from it completely, otherwise find that expense id and replace the amount owed to the co-payer with it

  // first get the remaining debts to see if there is an unsettled debt for a certain ID for the same debtor
  // covers both people now, since filteredDebt can contain entries "owned" by either of them once netting is involved
  const remaining = rawDebts.filter(
    (item) =>
      !filteredDebt.includes(item) &&
      (item.from === debtorId || item.from === creditorId),
  );

  let result = [];

  // id check
  filteredDebt.forEach((obj) => {
    // whichever person this specific raw entry says owes the money - not
    // always debtorId, since a netted-in reverse entry has creditorId owing
    const thisEntryDebtor = obj.from;

    // if there's a co payer send the amount to "deduct"
    if (
      remaining.length > 0 &&
      remaining.some(
        (item) =>
          item.expenseId === obj.expenseId && item.from === thisEntryDebtor,
      ) // check if at least one element passes the check with .some
    ) {
      result.push({
        expenseId: obj.expenseId,
        debtor: thisEntryDebtor,
        amount: obj.amount,
      });
      // with the absence of amount we can remove that entry entirely from db
    } else {
      result.push({ expenseId: obj.expenseId, debtor: thisEntryDebtor });
    }
  });

  await fetch("/markSettled/6a445ee01781d2a29c611442", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(result),
  });
}

// removing the paid debts when mark as settled is clicked
document
  .getElementById("debtBreakdown")
  .addEventListener("click", async (event) => {
    const btn = event.target.closest(".settle");
    if (!btn) return;
    if (btn.dataset.loading === "true") return; // guard against double-click

    const originalBtn = btn.innerHTML;
    btn.dataset.loading = "true";
    btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    const settleError = document.getElementById("settleError");
    settleError.classList.add("hidden");

    const collapseSection = btn.closest(".collapse");
    const creditorId = collapseSection.querySelector(
      ".collapse-title .person-pill",
    ).dataset.id;

    const checkedRows = [...collapseSection.querySelectorAll(".debtor")].filter(
      (row) => row.querySelector("input[type='checkbox']").checked,
    );

    // the user might check several debtor checkboxes in one creditor's section  wait for the full result before setting up the page again
    await Promise.all(
      checkedRows.map(async (row) => {
        const debtorId = row.querySelector(".person-pill").dataset.id;
        const amount = Number(row.querySelector(".amount").textContent);
        const response = await fetch("/payment/6a445ee01781d2a29c611442", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: creditorId,
            from: debtorId,
            amount: amount,
          }),
        });
        if (!response.ok) {
          btn.dataset.loading = "false";
          btn.innerHTML = originalBtn;
          settleError.textContent = "Failed to settle debt. Please try again.";
          settleError.classList.remove("hidden");
          return; // don't mark it settled if recording the payment failed
        }
        return markAsSettled(debtorId, creditorId);
      }),
    );

    // re-render everything from the DB now that it reflects the settlement,
    // rather than hand-patching the DOM to guess what changed
    setUpPage().then(refreshFilterCard);
  });

//========================================================================
// rendering the debt breakdown section in the ui
//========================================================================
async function renderDebtBreakdown() {
  const [nettedResult, people] = await Promise.all([
    computeDebtBreakdown(),
    getPeople(),
  ]);
  const container = document.getElementById("debtBreakdown");
  container.innerHTML = "";

  people.forEach((person) => {
    const netPerPerson = nettedResult.filter((item) => item.to === person._id);
    if (netPerPerson.length > 0) {
      let sum = 0;
      for (let i = 0; i < netPerPerson.length; i++) {
        sum += netPerPerson[i].amount;
      }

      let element = `<div class="collapse collapse-plus border-b border-base-200">
      <input type="checkbox" />
      <div class="collapse-title">
        <div class="flex items-center justify-between">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium person-pill"
            data-name="${person.name}"
            data-id="${person._id}"
            style="background: ${person.badgeInfo.bg}; color: ${person.badgeInfo.color}; border: none"
            >${person.name}</span
          >
          <span class="text-sm text-base-content/50"
            >is owed
            <span class="font-semibold text-base-content">$</span
            ><span class="font-semibold text-base-content owed">${sum}</span
            ></span
          >
        </div>
      </div>
      <div class="collapse-content flex flex-col gap-2">`;

      netPerPerson.forEach((debt) => {
        const debtor = people.find(
          (individual) => individual._id === debt.from,
        );
        element += `
        <div class="flex items-center justify-between debtor">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium person-pill"
            data-name="${debtor.name}"
            data-id="${debtor._id}"
            style="background: ${debtor.badgeInfo.bg}; color: ${debtor.badgeInfo.color}; border: none"
            >${debtor.name}</span
          >
          <div class="flex items-center text-sm font-thin">
            $<div class="flex flex-row gap-1 justify-center items-center "><span class="amount">${debt.amount}</span>
            <input type="checkbox" class="checkbox checkbox-success" />
            </div>
          </div>
        </div>`;
      });

      element += `
        <button class="btn btn-xs btn-success self-end settle hidden">
          Mark as settled
        </button>
      </div>
    </div>`;

      container.insertAdjacentHTML("beforeend", element);
    }
  });
}

// ========================================================================================
// the filtering logic
// ========================================================================================
// attached once, since #person-filters and its buttons are static HTML that
// exists from page load - isOwedBreakdown/isDebtorBreakdown are re-queried
// fresh on every click instead, since #debtBreakdown gets rebuilt whenever
// renderDebtBreakdown() re-runs (e.g. after adding/deleting an expense)

// tracks which person the filter card is currently showing, so
// `refreshFilterCard` can re-render it with fresh data after an
// add/delete/settle - null means the filter card is closed and there's
// nothing to refresh
let currentFilterPerson = null;

// rebuilds #filterCard for the given person from the current #debtBreakdown DOM
function renderFilterCard(personName) {
  const container = document.getElementById("filterCard");
  let result = "";
  container.innerHTML = "";

  const isOwedBreakdown = document.querySelectorAll(
    "#debtBreakdown .collapse-title .person-pill",
  );
  const isDebtorBreakdown = document.querySelectorAll(
    "#debtBreakdown .collapse-content .person-pill",
  );

  const isOwed = [...isOwedBreakdown].find(
    (element) => element.dataset.name === personName,
  );

  const hasDebts = [...isDebtorBreakdown].filter(
    (element) => element.dataset.name === personName,
  );

  // holds actual DOM element
  const personBadge = peopleBadges.find(
    (item) => item.dataset.name === personName,
  );
  personBadge.classList.remove("border-2");
  if (hasDebts.length > 0 || isOwed) {
    result += `<div class="flex items-center justify-between">
                  ${personBadge.outerHTML}`;

    // if the person is owed something
    if (isOwed) {
      const sum = isOwed
        .closest(".collapse-title")
        .querySelector(".owed").textContent;
      result += `
                  <span class="text-sm text-base-content/50"
                    >total owed $<span class="font-semibold text-base-content"
                      >${sum}</span
                    ></span
                  >`;
    }

    result += `</div>`;
  } else {
    result += `<div class="flex items-center justify-between">
                  ${personBadge.outerHTML}
                  <span class="text-sm text-base-content/50">no debts to show</span>
                </div>`;
  }

  if (hasDebts.length > 0) {
    result += `<div class="flex flex-col gap-2">`;
    hasDebts.forEach((item) => {
      const owesTo = item
        .closest(".collapse")
        .querySelector(".collapse-title .person-pill").textContent;
      const amountOwes = item
        .closest(".debtor")
        .querySelector(".amount").textContent;
      result += `
                <div class="flex items-center justify-between">
                  <span class="pl-2 text-sm text-base-content/60"
                    >owes <span>${owesTo}</span></span
                  >
                  <span class="font-medium">$<span>${amountOwes}</span></span>
                </div>
              `;
    });
    result += `</div>`;
  }
  container.insertAdjacentHTML("beforeend", result);
}

// re-renders the filter card with the currently selected person, if any -
// call after setUpPage() so the open filter card doesn't stay stale
function refreshFilterCard() {
  if (currentFilterPerson) renderFilterCard(currentFilterPerson);
}

document.getElementById("person-filters").addEventListener("click", (event) => {
  const btn = event.target.closest(".btn");
  if (!btn) return;

  const resetbtn = document.getElementById("resetFilter");

  if (btn.id === "resetFilter") {
    document.getElementById("filterCard").innerHTML = "";
    document.getElementById("filter-result").classList.add("hidden");
    resetbtn.classList.add("hidden");
    currentFilterPerson = null;
    return;
  }

  document.getElementById("filter-result").classList.remove("hidden");
  resetbtn.classList.remove("hidden");
  currentFilterPerson = btn.dataset.name;
  renderFilterCard(currentFilterPerson);
});

// ===========================================================================
// showing total spent per person in the trip -dynamically
// ===========================================================================

// first get the info from the db and calculate spending for each person
async function calculateSpending() {
  const people = await getPeople();
  const personsIds = people.map((person) => person._id);
  const results = await Promise.all(
    personsIds.map((id) =>
      fetch(`/spentDetails/6a445ee01781d2a29c611442/${id}`).then((res) =>
        res.json(),
      ),
    ),
  );
  return results;
}

// render the results
function renderSpending(results) {
  const container = document.getElementById("totalSpent");
  container.innerHTML = "";
  results.forEach((element) => {
    const personName = peopleBadges.find(
      (person) => person.dataset.id === element.id,
    ).dataset.name;
    const totalSpent = Number(element.expenses) + Number(element.payments);
    let stat = ` <div
            class="stats shadow-sm border border-base-200"
            style="background: #eeedfe"
          >
            <div class="stat py-2 px-4 place-items-center text-center">
              <div class="stat-title text-xs font-medium" style="color: #534ab7">
                ${personName}
              </div>
              <div class="stat-value text-lg" style="color: #534ab7"><span>$</span>${totalSpent}</div>
            </div>

          </div>`;
    container.insertAdjacentHTML("beforeend", stat);
  });
}

// ======================================================================================================================
// simplest way to settle logic - repeatedly match the largest creditor with the largest debtor , cancel out the debt
// store the info as one transaction and repeat the process.
// we can already use the cleaned data we used in debt breakdown section , which already includes pairwise netting
// =======================================================================================================================

// calculate the net amounts for each person
function netAmountCalc() {
  // total amount owed by each person
  // this will store all the spans that contain "is owed" section for all the persons
  const allOwedNodes = document
    .getElementById("debtBreakdown")
    .querySelectorAll(".collapse-title .person-pill");

  // all the nodes- debt for each person
  const allDebtNodes = document
    .getElementById("debtBreakdown")
    .querySelectorAll(".collapse-content .person-pill");

  let result = [];
  peopleBadges.forEach((element) => {
    const owed = [...allOwedNodes].find(
      (item) => item.dataset.id === element.dataset.id,
    );

    // a debtor can be seen in multiple rows - get all of them
    const debtor = [...allDebtNodes].filter(
      (item) => item.dataset.id === element.dataset.id,
    );
    let owedAmount;
    if (owed) {
      owedAmount = Number(
        owed.closest(".collapse-title").querySelector(".owed").textContent,
      );
    } else {
      owedAmount = 0;
    }

    let debtAmount;
    if (debtor) {
      const personDebtArray = debtor.map((debt) =>
        Number(debt.closest(".debtor").querySelector(".amount").textContent),
      );
      debtAmount = personDebtArray.reduce((accum, debt) => accum + debt, 0);
    } else {
      debtAmount = 0;
    }

    // is owed amount will be recorded for each person once - if exist, but that could appear multiple times for debts
    const existing = result.find((item) => item.id === element.dataset.id);
    if (existing) {
      existing.debt += debtAmount;
    } else {
      result.push({
        id: element.dataset.id,
        owed: owedAmount,
        debt: debtAmount,
      });
    }
  });

  let netted = [];
  result.forEach((entry) => {
    const net = entry.owed - entry.debt;
    netted.push({ id: entry.id, net: net });
  });

  return netted;
}

// calculate min number of transaction to settle
function simplestSettle(netted) {
  let transactions = [];
  // netted is an array of obj for each person where net > 0 shows the person is owed and net < 0 shows the person owes sth
  while (netted.length > 1) {
    // Descending order (highest to lowest) - biggest creditor would be at index 0 and the biggest debtor would be at last
    // netted would be mutated in place
    netted.sort((a, b) => b.net - a.net);
    // cap at whichever side is smaller, so we never pay the creditor more than they're owed 
    // totals sum to zero, but one debtor can still owe more than any single creditor is due (e.g. A:30, D:30, B:-60)
    const amount = Math.min(netted[0].net, -(netted[netted.length - 1].net));
    transactions.push({
      to: netted[0].id,
      from: netted[netted.length - 1].id,
      amount: amount,
    });
    netted[0].net -= amount;
    netted[netted.length - 1].net += amount;
    // drop anyone who's now fully settled
    netted = netted.filter((entry) => Math.abs(entry.net) > 0.01);
    continue;
  }
  return transactions;
}
