import express from "express";
import axios from "axios";

const app = express();

const SANDBOX_BASE_URL = "https://sandbox-quickbooks.api.intuit.com";
const PROD_BASE_URL = "https://quickbooks.api.intuit.com";

const accessToken = "";

const users = [
  { id: 9529, first_name: "Monday", last_name: "User", name: "Emily Platt" },
];

const clients = [{ id: 343, name: "Monday Client Test" }];

let axiosRequest = axios.create({
  headers: {
    Authorization: "Bearer " + accessToken,
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
});

const projects = [
  {
    id: 23891,
    kind: "billable",
    client_id: 343,
  },
];

const log = {
  id: 54455,
  account_id: 1106,
  project_id: 23891,
  user_id: 9529,
  date: "2023-06-02",
  duration: 320,
  occupation_id: null,
  activity_id: null,
  approved: false,
  comment: null,
  created_at: "2023-06-11T14:21:57.256Z",
  updated_at: "2023-06-11T14:21:57.256Z",
};

const sendLog = () => {
  axiosRequest
    .get(
      `${SANDBOX_BASE_URL}/v3/company/4620816365310516730/query?query=select * from Employee &minorversion=65`
    )

    // get all employes from API
    .then((response) => {
      let user = response.data.QueryResponse.Employee.find(
        (user) =>
          user.DisplayName ===
          users.find((user) => user.id === log.user_id).name
      );

      // find log user among quickbooks employees

      if (user) {
        let isBillable =
          projects.find((pr) => pr.id === log.project_id).kind === "billable";
        // check is log billable

        let log_data = {
          NameOf: "Employee",
          TxnDate: log.date,
          Hours: log.duration / 60,
          EmployeeRef: {
            name: user.DisplayName, // required fields if project is billable
            value: user.Id, //
          },
        };

        if (isBillable) {
          log_data.BillableStatus = "Billable";
          log_data.HourlyRate = user.BillRate;

          // if billable we should find client in QuickBooks customers
          axiosRequest
            .get(
              SANDBOX_BASE_URL +
                "/v3/company/4620816365310516730/query?query=select * from Customer &minorversion=40" // get all customers
            )
            .then((r) => {
              let customers = r.data.QueryResponse.Customer;

              // find project of actual log client

              let quickbooks_log_client = customers.find(
                (customer) =>
                  customer.DisplayName ===
                    clients.find(
                      (client) =>
                        client.id ===
                        projects.find(
                          (project) => project.id === log.project_id
                        ).client_id
                    )?.name || null
              );

              if (quickbooks_log_client) {
                // log with already created customer

                axiosRequest.post(
                  SANDBOX_BASE_URL +
                    "/v3/company/4620816365310516730/timeactivity?minorversion=40",
                  {
                    ...log_data,
                    CustomerRef: {
                      name: quickbooks_log_client.GivenName,
                      value: quickbooks_log_client.Id,
                    },
                  }
                );
              } else {
                //find client of project
                let log_client = clients.find(
                  (client) =>
                    client.id ===
                    projects.find((project) => project.id === log.project_id)
                      .client_id
                );

                //create new customer if QuickBooks does'nt have customer with client's name
                axiosRequest
                  .post(
                    SANDBOX_BASE_URL +
                      "/v3/company/4620816365310516730/customer?minorversion=40",
                    {
                      DisplayName: log_client.name,
                    }
                  )
                  .then((response) => {
                    //send log with created customer

                    axiosRequest
                      .post(
                        SANDBOX_BASE_URL +
                          "/v3/company/4620816365310516730/timeactivity?minorversion=40",
                        {
                          ...log_data,
                          CustomerRef: {
                            name: response.data.QueryResponse.Customer
                              .GivenName,
                            value: response.data.QueryResponse.Customer.Id,
                          },
                        }
                      )
                      .then((r) => console.log(r.data));
                  });
              }
            });
        }
      }
    });
};

app.get("/", (req, res) => {});

app.listen(3001, () => {
  sendLog();
});
