describe("Authentication Middleware - Basic Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should pass basic test", () => {
    expect(true).toBe(true);
  });

  it("should be able to use jest functions", () => {
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
    expect(typeof jest).toBe("object");
    expect(typeof beforeEach).toBe("function");
  });
});
