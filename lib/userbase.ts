"use client"

// Userbase SDK wrapper for TypeScript
import { useEffect, useState, useCallback, useRef } from "react"

// Define types for Userbase SDK
interface UserbaseUser {
  username: string
  userId: string
}

interface UserbaseSession {
  user: UserbaseUser
}

interface UserbaseError {
  name: string
  message: string
  status?: number
}

// Update the type definitions for rememberMe
interface UserbaseSignUpOptions {
  username: string
  password: string
  rememberMe?: "local" | "session" | "none"
}

interface UserbaseSignInOptions {
  username: string
  password: string
  rememberMe?: "local" | "session" | "none"
}

interface UserbaseInitOptions {
  appId: string
}

interface UserbaseUpdateUserOptions {
  username?: string
  currentPassword?: string
  newPassword?: string
}

// Define the global Userbase object
declare global {
  interface Window {
    userbase: {
      init: (options: UserbaseInitOptions) => Promise<UserbaseSession | null>
      signUp: (options: UserbaseSignUpOptions) => Promise<UserbaseUser>
      signIn: (options: UserbaseSignInOptions) => Promise<UserbaseUser>
      signOut: () => Promise<void>
      deleteUser: () => Promise<void>
      forgotPassword: (options: { username: string }) => Promise<void>
      updateUser: (options: UserbaseUpdateUserOptions) => Promise<void>

      // Database operations
      openDatabase: (options: { databaseName: string; changeHandler: Function }) => Promise<any>
      insertItem: (options: { databaseName: string; item: any }) => Promise<any>
      updateItem: (options: { databaseName: string; itemId: string; item: any }) => Promise<any>
      deleteItem: (options: { databaseName: string; itemId: string }) => Promise<any>
    }
  }
}

// Userbase app ID - replace with your actual app ID from Userbase dashboard
const USERBASE_APP_ID = "dac63be6-e3b8-4fd3-a84a-aadb4f7ec9d2"

// Global state to track if Userbase SDK is loaded
let isUserbaseLoaded = false

// Hook for Userbase authentication
export function useUserbase() {
  const [user, setUser] = useState<UserbaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const initAttempted = useRef(false)

  // Initialize Userbase
  useEffect(() => {
    if (initAttempted.current) return

    // Set flag to prevent multiple initialization attempts
    initAttempted.current = true

    // Check if Userbase is already loaded
    if (isUserbaseLoaded && window.userbase) {
      initUserbase()
      return
    }

    // Load Userbase script
    const script = document.createElement("script")
    script.src = "https://sdk.userbase.com/2/userbase.js"
    script.async = true

    script.onload = () => {
      console.log("Userbase SDK loaded")
      isUserbaseLoaded = true
      setSdkLoaded(true)
      initUserbase()
    }

    script.onerror = () => {
      console.error("Failed to load Userbase SDK")
      setError("Failed to load Userbase SDK")
      setLoading(false)
      setSdkLoaded(false)
    }

    document.body.appendChild(script)

    return () => {
      // Don't remove the script on unmount as it might be needed by other components
    }
  }, [])

  // Initialize Userbase after SDK is loaded
  const initUserbase = useCallback(async () => {
    if (!window.userbase) {
      console.error("Userbase SDK not available")
      setError("Userbase SDK not available")
      setLoading(false)
      return
    }

    try {
      console.log("Initializing Userbase...")
      const session = await window.userbase.init({ appId: USERBASE_APP_ID })
      console.log("Userbase initialized:", session ? "Session found" : "No session")

      if (session && session.user) {
        setUser(session.user)
      }
      setLoading(false)
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error("Userbase init error:", userbaseError)
      setError(userbaseError.message)
      setLoading(false)
    }
  }, [])

  // Re-initialize when SDK is loaded
  useEffect(() => {
    if (sdkLoaded && !loading && !user) {
      initUserbase()
    }
  }, [sdkLoaded, initUserbase, loading, user])

  // Fix the signUp function to use the correct rememberMe value
  const signUp = async (username: string, password: string, rememberMe: "local" | "session" | "none" = "local") => {
    setError(null)

    if (!window.userbase) {
      const error = new Error("Userbase SDK not available")
      console.error(error)
      setError(error.message)
      throw error
    }

    try {
      console.log("Signing up user:", username)
      const user = await window.userbase.signUp({
        username,
        password,
        rememberMe,
      })
      console.log("User signed up successfully")
      setUser(user)
      return user
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error("Sign up error:", userbaseError)
      setError(userbaseError.message)
      throw err
    }
  }

  // Fix the signIn function to use the correct rememberMe value
  const signIn = async (username: string, password: string, rememberMe: "local" | "session" | "none" = "local") => {
    setError(null)

    if (!window.userbase) {
      const error = new Error("Userbase SDK not available")
      console.error(error)
      setError(error.message)
      throw error
    }

    try {
      console.log("Signing in user:", username)
      const user = await window.userbase.signIn({
        username,
        password,
        rememberMe,
      })
      console.log("User signed in successfully")
      setUser(user)
      return user
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error("Sign in error:", userbaseError)
      setError(userbaseError.message)
      throw err
    }
  }

  // Sign out function
  const signOut = async () => {
    setError(null)

    if (!window.userbase) {
      const error = new Error("Userbase SDK not available")
      console.error(error)
      setError(error.message)
      throw error
    }

    try {
      console.log("Signing out user")
      await window.userbase.signOut()
      console.log("User signed out successfully")
      setUser(null)
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error("Sign out error:", userbaseError)
      setError(userbaseError.message)
      throw err
    }
  }

  // Update user function
  const updateUser = async (options: UserbaseUpdateUserOptions) => {
    setError(null)

    if (!window.userbase) {
      const error = new Error("Userbase SDK not available")
      console.error(error)
      setError(error.message)
      throw error
    }

    try {
      console.log("Updating user")
      await window.userbase.updateUser(options)
      console.log("User updated successfully")
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error("Update user error:", userbaseError)
      setError(userbaseError.message)
      throw err
    }
  }

  // Delete user function
  const deleteUser = async () => {
    setError(null)

    if (!window.userbase) {
      const error = new Error("Userbase SDK not available")
      console.error(error)
      setError(error.message)
      throw error
    }

    try {
      console.log("Deleting user")
      await window.userbase.deleteUser()
      console.log("User deleted successfully")
      setUser(null)
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error("Delete user error:", userbaseError)
      setError(userbaseError.message)
      throw err
    }
  }

  return {
    user,
    loading,
    error,
    sdkLoaded,
    signUp,
    signIn,
    signOut,
    updateUser,
    deleteUser,
  }
}

// Update the useUserbaseDatabase hook to handle authentication state changes better
export function useUserbaseDatabase(databaseName: string) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDbOpen, setIsDbOpen] = useState(false)
  const { user, loading: userLoading, sdkLoaded } = useUserbase() // Get the current user state
  const dbOpenAttempts = useRef(0)
  const maxRetries = 3
  const retryTimeout = useRef<NodeJS.Timeout | null>(null)

  // Function to open the database with retry logic
  const openDatabase = useCallback(async () => {
    // Clear any existing retry timeout
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current)
      retryTimeout.current = null
    }

    // Skip if no user or SDK not loaded
    if (!user || !sdkLoaded || !window.userbase) {
      setLoading(false)
      setIsDbOpen(false)
      return
    }

    try {
      console.log(`Opening database "${databaseName}"...`)
      await window.userbase.openDatabase({
        databaseName,
        changeHandler: (items: any[]) => {
          console.log(`Database "${databaseName}" opened successfully with ${items.length} items`)
          setItems(items)
          setLoading(false)
          setIsDbOpen(true)
          setError(null)
          dbOpenAttempts.current = 0 // Reset attempts on success
        },
      })
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error(`Error opening database "${databaseName}":`, userbaseError)
      setError(userbaseError.message)
      setLoading(false)
      setIsDbOpen(false)

      // Retry logic for authentication errors
      if (userbaseError.message === "Not signed in." && dbOpenAttempts.current < maxRetries) {
        dbOpenAttempts.current++
        console.log(`Retrying database open (attempt ${dbOpenAttempts.current}/${maxRetries})...`)

        // Exponential backoff for retries
        const delay = Math.pow(2, dbOpenAttempts.current) * 1000
        retryTimeout.current = setTimeout(openDatabase, delay)
      }
    }
  }, [databaseName, user, sdkLoaded])

  // Effect to open database when user is available
  useEffect(() => {
    // Skip if user is loading or SDK not loaded
    if (userLoading || !sdkLoaded) {
      return
    }

    // If no user, reset state
    if (!user) {
      setItems([])
      setIsDbOpen(false)
      setLoading(false)
      return
    }

    // Open database with a slight delay to ensure authentication is fully established
    const timer = setTimeout(() => {
      openDatabase()
    }, 500)

    return () => {
      clearTimeout(timer)
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current)
      }
    }
  }, [user, userLoading, sdkLoaded, openDatabase])

  // Reset state when user signs out
  useEffect(() => {
    if (!user) {
      setItems([])
      setIsDbOpen(false)
    }
  }, [user])

  // Wrapper function for database operations with authentication checks
  const executeDbOperation = async <T,>(operation: string, dbFunction: () => Promise<T>): Promise<T> => {
    setError(null)

    // Verify authentication before proceeding
    if (!user) {
      console.error(`Cannot ${operation}: Not signed in`)
      const notSignedInError = new Error("Not signed in")
      setError(notSignedInError.message)
      throw notSignedInError
    }

    if (!isDbOpen) {
      console.error(`Cannot ${operation}: Database not open`)
      const dbNotOpenError = new Error("Database is not open")
      setError(dbNotOpenError.message)
      throw dbNotOpenError
    }

    // Verify Userbase SDK is available
    if (!window.userbase) {
      console.error(`Cannot ${operation}: Userbase SDK not available`)
      const sdkError = new Error("Userbase SDK not available")
      setError(sdkError.message)
      throw sdkError
    }

    try {
      // Double-check authentication before proceeding
      if (!user) throw new Error("Not signed in")

      return await dbFunction()
    } catch (err) {
      const userbaseError = err as UserbaseError
      console.error(`Userbase ${operation} error:`, userbaseError)
      setError(userbaseError.message)
      throw err
    }
  }

  const insertItem = async (item: any) => {
    return executeDbOperation("insert item", async () => {
      return await window.userbase.insertItem({
        databaseName,
        item,
      })
    })
  }

  const updateItem = async (itemId: string, item: any) => {
    return executeDbOperation("update item", async () => {
      return await window.userbase.updateItem({
        databaseName,
        itemId,
        item,
      })
    })
  }

  const deleteItem = async (itemId: string) => {
    return executeDbOperation("delete item", async () => {
      return await window.userbase.deleteItem({
        databaseName,
        itemId,
      })
    })
  }

  return {
    items,
    loading,
    error,
    isDbOpen,
    insertItem,
    updateItem,
    deleteItem,
    isAuthenticated: !!user,
  }
}
