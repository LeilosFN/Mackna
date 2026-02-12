use std::ffi::CString;
use std::ptr;
use std::mem;
use winapi::um::processthreadsapi::{OpenProcess, CreateRemoteThread};
use winapi::um::memoryapi::{VirtualAllocEx, WriteProcessMemory};
use winapi::um::libloaderapi::{GetModuleHandleA, GetProcAddress};
use winapi::um::winnt::{PROCESS_ALL_ACCESS, MEM_COMMIT, MEM_RESERVE, PAGE_READWRITE};
use winapi::um::handleapi::CloseHandle;
use winapi::um::synchapi::WaitForSingleObject;
use winapi::um::winbase::INFINITE;

pub struct DllInjector;

impl DllInjector {
    pub fn new() -> Self {
        DllInjector
    }

    pub fn inject(&self, process_id: u32, dll_path: &str) -> Result<(), String> {
        unsafe {
            // 1. Open Process
            let h_process = OpenProcess(PROCESS_ALL_ACCESS, 0, process_id);
            if h_process.is_null() {
                return Err(format!("Failed to open process {}. Error: {}", process_id, std::io::Error::last_os_error()));
            }

            // Ensure handle is closed when we are done
            // Using a simple defer-like pattern via a struct or just manual close on all paths
            // Here we use manual close for simplicity but must be careful

            let dll_path_c = CString::new(dll_path).map_err(|e| e.to_string())?;
            let dll_path_len = dll_path_c.as_bytes_with_nul().len();

            // 2. Allocate Memory
            let p_remote_mem = VirtualAllocEx(
                h_process,
                ptr::null_mut(),
                dll_path_len,
                MEM_COMMIT | MEM_RESERVE,
                PAGE_READWRITE,
            );

            if p_remote_mem.is_null() {
                CloseHandle(h_process);
                return Err(format!("Failed to allocate memory in target process. Error: {}", std::io::Error::last_os_error()));
            }

            // 3. Write DLL path to memory
            let mut bytes_written = 0;
            let write_result = WriteProcessMemory(
                h_process,
                p_remote_mem,
                dll_path_c.as_ptr() as *const _,
                dll_path_len,
                &mut bytes_written,
            );

            if write_result == 0 {
                CloseHandle(h_process);
                return Err(format!("Failed to write to process memory. Error: {}", std::io::Error::last_os_error()));
            }

            // 4. Get LoadLibraryA address
            let kernel32 = CString::new("kernel32.dll").unwrap();
            let h_kernel32 = GetModuleHandleA(kernel32.as_ptr());
            if h_kernel32.is_null() {
                CloseHandle(h_process);
                return Err("Failed to get handle for kernel32.dll".to_string());
            }

            let load_library_name = CString::new("LoadLibraryA").unwrap();
            let p_load_library = GetProcAddress(h_kernel32, load_library_name.as_ptr());
            
            if p_load_library.is_null() {
                CloseHandle(h_process);
                return Err("Failed to get address of LoadLibraryA".to_string());
            }

            // 5. Create Remote Thread
            // Transmute the function pointer to the type expected by CreateRemoteThread
            // LPTHREAD_START_ROUTINE is Option<unsafe extern "system" fn(LPVOID) -> DWORD>
            let p_load_library_routine: winapi::um::minwinbase::LPTHREAD_START_ROUTINE = 
                mem::transmute(p_load_library);

            let h_thread = CreateRemoteThread(
                h_process,
                ptr::null_mut(),
                0,
                p_load_library_routine,
                p_remote_mem,
                0,
                ptr::null_mut(),
            );

            if h_thread.is_null() {
                CloseHandle(h_process);
                return Err(format!("Failed to create remote thread. Error: {}", std::io::Error::last_os_error()));
            }

            // Wait for thread to finish
            WaitForSingleObject(h_thread, INFINITE);

            // Cleanup
            CloseHandle(h_thread);
            CloseHandle(h_process);

            Ok(())
        }
    }
}
