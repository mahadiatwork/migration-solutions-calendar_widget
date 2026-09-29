import {
  getActivityTypeSelection,
  getCreateActivityDefaults,
} from "./createActivityDefaults";

describe("calendar create activity defaults", () => {
  test("does not use the first CRM picklist rows as create defaults", () => {
    const picklistConfig = {
      types: ["Fruit"],
      regarding: { Fruit: ["Pear"] },
    };

    expect(picklistConfig.types[0]).toBe("Fruit");
    expect(picklistConfig.regarding.Fruit[0]).toBe("Pear");
    expect(getCreateActivityDefaults()).toEqual({
      title: "New Activity",
      Type_of_Activity: "",
      Regarding: "",
    });
  });

  test("clears Regarding when an activity type is explicitly selected", () => {
    expect(getActivityTypeSelection({ type: "Fruit", resource: 7 })).toEqual({
      Type_of_Activity: "Fruit",
      resource: 7,
      Regarding: "",
    });
  });
});
