/**
 * @deprecated Import from `@/lib/customerApi` instead. Re-exports kept for gradual migration.
 */
export type { CustomerRecord, CustomerWritePayload } from './customerApi';
export {
    listCustomers,
    listCustomersPaged,
    fetchCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    findCustomerByGstin,
    findCustomerByName,
} from './customerApi';
